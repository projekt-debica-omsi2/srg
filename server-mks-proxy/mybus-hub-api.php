<?php
declare(strict_types=1);

/*
 * myBus Polska Hub
 * Lista profili pochodzi z aplikacji myBus 2.8.9 przekazanej przez właściciela strony.
 * API jest ograniczone do PingService i GetVehicles oraz do statycznej listy miast.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-MyBus-Hub: 1');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$cities = require __DIR__ . '/mybus-cities-config.php';
$action = trim((string)($_GET['action'] ?? 'vehicles'));

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

function cache_root(): string
{
    $root = rtrim(sys_get_temp_dir(), "\\/") . DIRECTORY_SEPARATOR . 'e-debica-mybus-hub';
    if (!is_dir($root)) {
        @mkdir($root, 0770, true);
    }
    return $root;
}

function safe_key(string $key): string
{
    return preg_replace('/[^A-Z0-9_-]/', '_', strtoupper($key)) ?: 'UNKNOWN';
}

function read_json_file(string $path): ?array
{
    $raw = @file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        return null;
    }
    $value = json_decode($raw, true);
    return is_array($value) ? $value : null;
}

function atomic_json_write(string $path, array $value): void
{
    $tmp = $path . '.' . getmypid() . '.tmp';
    $encoded = json_encode(
        $value,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    if (!is_string($encoded)) {
        return;
    }
    if (@file_put_contents($tmp, $encoded, LOCK_EX) !== false) {
        @rename($tmp, $path);
    }
}


function atomic_binary_write(string $path, string $value): bool
{
    $tmp = $path . '.' . getmypid() . '.tmp';
    $written = @file_put_contents($tmp, $value, LOCK_EX);
    if ($written === false || $written !== strlen($value)) {
        @unlink($tmp);
        return false;
    }
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        return false;
    }
    return true;
}

function schedule_format(string $body): string
{
    if (substr($body, 0, 2) === "\x1f\x8b") return 'gzip';
    if (substr($body, 0, 16) === "SQLite format 3\x00") return 'sqlite';
    return 'binary';
}

function send_schedule_binary(
    string $path,
    string $cityKey,
    string $cityName,
    string $cacheState = 'HIT'
): never {
    if (!is_file($path)) {
        json_response(['ok' => false, 'error' => 'SCHEDULE_CACHE_MISSING'], 404);
    }

    $size = (int)@filesize($path);
    $head = '';
    $handle = @fopen($path, 'rb');
    if (is_resource($handle)) {
        $head = (string)@fread($handle, 32);
        @fclose($handle);
    }

    header('Content-Type: application/octet-stream');
    header('Content-Disposition: inline; filename="mybus-' . $cityKey . '-schedule.bin"');
    header('Cache-Control: public, max-age=21600, stale-while-revalidate=86400');
    header('X-MyBus-Schedule-City: ' . rawurlencode($cityName));
    header('X-MyBus-Schedule-Format: ' . schedule_format($head));
    header('X-MyBus-Schedule-Cache: ' . $cacheState);
    if ($size > 0) header('Content-Length: ' . $size);
    readfile($path);
    exit;
}

function token_sum(string $token): int
{
    $sum = 0;
    $length = strlen($token);
    for ($i = 0; $i < $length; $i++) {
        $sum += ord($token[$i]);
    }
    return $sum;
}

function decode_chunked(string $body): string
{
    $decoded = '';
    $position = 0;
    $length = strlen($body);

    while ($position < $length) {
        $lineEnd = strpos($body, "\r\n", $position);
        if ($lineEnd === false) return $body;

        $sizeLine = trim(substr($body, $position, $lineEnd - $position));
        $semicolon = strpos($sizeLine, ';');
        if ($semicolon !== false) $sizeLine = substr($sizeLine, 0, $semicolon);

        if ($sizeLine === '' || !ctype_xdigit($sizeLine)) return $body;
        $size = hexdec($sizeLine);
        $position = $lineEnd + 2;

        if ($size === 0) break;
        if ($position + $size > $length) return $body;

        $decoded .= substr($body, $position, $size);
        $position += $size;
        if (substr($body, $position, 2) === "\r\n") $position += 2;
    }
    return $decoded;
}

/**
 * @return array{status:int,headers:array<string,string>,body:string,error:string,url:string}
 */
function socket_request(
    string $url,
    string $age,
    int $redirects = 0,
    int $maxBytes = 12582912,
    int $timeout = 18
): array
{
    if ($redirects > 3) {
        return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'TOO_MANY_REDIRECTS', 'url' => $url];
    }

    $parts = parse_url($url);
    if (!is_array($parts) || empty($parts['host'])) {
        return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'INVALID_URL', 'url' => $url];
    }

    $scheme = strtolower((string)($parts['scheme'] ?? 'http'));
    $host = (string)$parts['host'];
    $port = (int)($parts['port'] ?? ($scheme === 'https' ? 443 : 80));
    $path = (string)($parts['path'] ?? '/');
    if (isset($parts['query']) && $parts['query'] !== '') {
        $path .= '?' . $parts['query'];
    }

    $contextOptions = [];
    $transport = 'tcp';
    if ($scheme === 'https') {
        $transport = 'tls';
        $contextOptions['ssl'] = [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'peer_name' => $host,
            'SNI_enabled' => true,
            'SNI_server_name' => $host,
            'capture_peer_cert' => false,
        ];
    } elseif ($scheme !== 'http') {
        return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'UNSUPPORTED_SCHEME', 'url' => $url];
    }

    $context = stream_context_create($contextOptions);
    $errno = 0;
    $errstr = '';
    $socket = @stream_socket_client(
        $transport . '://' . $host . ':' . $port,
        $errno,
        $errstr,
        7,
        STREAM_CLIENT_CONNECT,
        $context
    );

    if (!is_resource($socket)) {
        return [
            'status' => 0, 'headers' => [], 'body' => '',
            'error' => 'CONNECT ' . $errno . ': ' . $errstr, 'url' => $url
        ];
    }

    stream_set_timeout($socket, $timeout);
    $hostHeader = $host;
    if (($scheme === 'http' && $port !== 80) || ($scheme === 'https' && $port !== 443)) {
        $hostHeader .= ':' . $port;
    }

    $request = implode("\r\n", [
        'GET ' . ($path !== '' ? $path : '/') . ' HTTP/1.1',
        'Host: ' . $hostHeader,
        'User-Agent: myBusOnline',
        'Age: ' . $age,
        'Accept: application/xml, text/xml, */*; q=0.01',
        'Accept-Language: pl-PL,pl;q=0.9,en;q=0.6',
        'Accept-Encoding: identity',
        'Connection: close',
    ]) . "\r\n\r\n";

    $length = strlen($request);
    $written = 0;
    while ($written < $length) {
        $chunk = @fwrite($socket, substr($request, $written));
        if ($chunk === false || $chunk === 0) {
            fclose($socket);
            return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'WRITE_FAILED', 'url' => $url];
        }
        $written += $chunk;
    }

    $raw = '';
    while (!feof($socket) && strlen($raw) < $maxBytes) {
        $chunk = @fread($socket, 16384);
        if ($chunk === false) break;
        if ($chunk === '') {
            $meta = stream_get_meta_data($socket);
            if (!empty($meta['timed_out'])) {
                fclose($socket);
                return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'READ_TIMEOUT', 'url' => $url];
            }
            continue;
        }
        $raw .= $chunk;
    }
    fclose($socket);

    $separator = strpos($raw, "\r\n\r\n");
    if ($raw === '' || $separator === false) {
        return ['status' => 0, 'headers' => [], 'body' => '', 'error' => 'INVALID_HTTP_RESPONSE', 'url' => $url];
    }

    $head = substr($raw, 0, $separator);
    $body = substr($raw, $separator + 4);
    $lines = explode("\r\n", $head);
    $statusLine = array_shift($lines);
    $status = 0;
    if (is_string($statusLine) && preg_match('#^HTTP/\d(?:\.\d)?\s+(\d{3})#i', $statusLine, $m)) {
        $status = (int)$m[1];
    }

    $headers = [];
    foreach ($lines as $line) {
        $colon = strpos($line, ':');
        if ($colon === false) continue;
        $name = strtolower(trim(substr($line, 0, $colon)));
        $value = trim(substr($line, $colon + 1));
        $headers[$name] = isset($headers[$name]) ? $headers[$name] . ', ' . $value : $value;
    }

    if (stripos($headers['transfer-encoding'] ?? '', 'chunked') !== false) {
        $body = decode_chunked($body);
    }

    if ($status >= 300 && $status < 400 && !empty($headers['location'])) {
        $location = $headers['location'];
        if (!preg_match('#^https?://#i', $location)) {
            $base = $scheme . '://' . $hostHeader;
            $location = str_starts_with($location, '/') ? $base . $location : $base . '/' . $location;
        }
        return socket_request($location, $age, $redirects + 1, $maxBytes, $timeout);
    }

    return ['status' => $status, 'headers' => $headers, 'body' => $body, 'error' => '', 'url' => $url];
}

function service_url(array $city, string $method, array $query = []): string
{
    $base = rtrim((string)$city['endpoint'], '/');
    $url = $base . '/' . rawurlencode($method);
    if ($query) {
        $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }
    return $url;
}

function parse_ping_value(string $body): ?int
{
    if (preg_match('/<int\b[^>]*>\s*(-?\d+)\s*<\/int>/i', $body, $m)) {
        return (int)$m[1];
    }
    if (preg_match('/^\s*(-?\d+)\s*$/', strip_tags($body), $m)) {
        return (int)$m[1];
    }
    return null;
}

function is_unauthorized(string $body): bool
{
    return stripos($body, 'Unauthorized access') !== false;
}

function xml_attributes(string $fragment): array
{
    $attrs = [];
    if (preg_match_all('/([A-Za-z0-9_:-]+)\s*=\s*"([^"]*)"/u', $fragment, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $match) {
            $attrs[$match[1]] = html_entity_decode($match[2], ENT_QUOTES | ENT_XML1, 'UTF-8');
        }
    }
    return $attrs;
}

function num_value(mixed $value): ?float
{
    $text = str_replace(',', '.', trim((string)$value));
    if ($text === '' || !is_numeric($text)) return null;
    $number = (float)$text;
    return is_finite($number) ? $number : null;
}


function normalize_brigade_value(mixed $value): string
{
    $text = trim(preg_replace('/\\s+/u', ' ', (string)$value) ?? '');
    if ($text === '') return '';
    $upper = function_exists('mb_strtoupper')
        ? mb_strtoupper($text, 'UTF-8')
        : strtoupper($text);
    if (in_array($upper, ['0', '-', '_', 'BRAK', 'BRAK DANYCH', 'NULL', 'N/A'], true)) {
        return '';
    }
    return function_exists('mb_substr')
        ? mb_substr($text, 0, 24, 'UTF-8')
        : substr($text, 0, 24);
}

/**
 * Brygada jest zwracana tylko z atrybutu o jednoznacznej nazwie.
 * Nie zgadujemy jej z linii, wariantu, numeru kursu ani pojazdu.
 *
 * @return array{value:string,source:string}
 */
function extract_brigade(array $attributes): array
{
    $allowed = [
        'br' => true,
        'bry' => true,
        'bryg' => true,
        'brygada' => true,
        'brig' => true,
        'brigade' => true,
        'brigadeid' => true,
        'brigadecode' => true,
        'crew' => true,
        'crewid' => true,
        'crewcode' => true,
        'duty' => true,
        'dutyid' => true,
        'dutycode' => true,
    ];

    foreach ($attributes as $name => $rawValue) {
        $normalizedName = strtolower((string)preg_replace('/[^a-z0-9]/i', '', (string)$name));
        if (!isset($allowed[$normalizedName])) continue;
        $value = normalize_brigade_value($rawValue);
        if ($value !== '') {
            return ['value' => $value, 'source' => 'api:' . (string)$name];
        }
    }

    return ['value' => '', 'source' => ''];
}

function parse_vehicles(string $xml): array
{
    $vehicles = [];
    if (!preg_match_all('/<V\b([^>]*)\/?>/iu', $xml, $nodes, PREG_SET_ORDER)) {
        return $vehicles;
    }

    foreach ($nodes as $index => $node) {
        $a = xml_attributes($node[1]);
        $lat = num_value($a['y'] ?? null);
        $lon = num_value($a['x'] ?? null);
        if ($lat === null || $lon === null) continue;

        $line = trim((string)($a['nr'] ?? ''));
        $dir = trim((string)($a['kr'] ?? $a['op'] ?? ''));
        $number = trim((string)($a['nb'] ?? $a['id'] ?? ''));
        $delay = num_value($a['o'] ?? null);
        $brigade = extract_brigade($a);

        $vehicles[] = [
            'id' => $number !== '' ? $number : (string)($index + 1),
            'vehicleNo' => $number !== '' ? $number : '?',
            'tripId' => trim((string)($a['id'] ?? '')),
            'line' => $line !== '' ? $line : '?',
            'direction' => $dir !== '' ? $dir : 'brak danych',
            'variant' => trim((string)($a['wt'] ?? '')),
            'brigade' => $brigade['value'],
            'brigadeSource' => $brigade['source'],
            'lat' => $lat,
            'lon' => $lon,
            'delaySeconds' => $delay,
            'raw' => $a,
        ];
    }

    return $vehicles;
}

/**
 * @return array{ok:bool,token?:int,error?:string,http?:int}
 */
function refresh_token(array $city, string $statePath): array
{
    $age = 60 + token_sum((string)$city['token']);
    $response = socket_request(service_url($city, 'PingService'), (string)$age);
    if ($response['status'] < 200 || $response['status'] >= 300) {
        return ['ok' => false, 'error' => $response['error'] ?: ('Ping HTTP ' . $response['status']), 'http' => $response['status']];
    }
    if (is_unauthorized($response['body'])) {
        return ['ok' => false, 'error' => 'Unauthorized access', 'http' => $response['status']];
    }
    $token = parse_ping_value($response['body']);
    if ($token === null) {
        return ['ok' => false, 'error' => 'Nieprawidłowa odpowiedź PingService', 'http' => $response['status']];
    }

    atomic_json_write($statePath, ['token' => $token, 'at' => time()]);
    return ['ok' => true, 'token' => $token, 'http' => $response['status']];
}

if ($action === 'cities') {
    $public = [];
    foreach ($cities as $key => $city) {
        $public[] = [
            'key' => $key,
            'name' => $city['name'],
            'lat' => $city['lat'],
            'lon' => $city['lon'],
            'lang' => $city['lang'],
        ];
    }
    usort($public, fn(array $a, array $b): int => strcoll($a['name'], $b['name']));
    json_response(['ok' => true, 'count' => count($public), 'cities' => $public]);
}

$key = safe_key((string)($_GET['city'] ?? ''));
if (!isset($cities[$key])) {
    json_response(['ok' => false, 'error' => 'UNKNOWN_CITY'], 404);
}
$city = $cities[$key];

$root = cache_root();
$cachePath = $root . DIRECTORY_SEPARATOR . $key . '.vehicles.json';
$statePath = $root . DIRECTORY_SEPARATOR . $key . '.state.json';
$lockPath = $root . DIRECTORY_SEPARATOR . $key . '.lock';
$cacheTtl = 20;

if ($action === 'schedule') {
    $schedulePath = $root . DIRECTORY_SEPARATOR . $key . '.schedule.bin';
    $scheduleLockPath = $root . DIRECTORY_SEPARATOR . $key . '.schedule.lock';
    $scheduleTtl = 12 * 60 * 60;

    if (is_file($schedulePath) && time() - (int)@filemtime($schedulePath) <= $scheduleTtl) {
        send_schedule_binary($schedulePath, $key, (string)$city['name'], 'HIT');
    }

    $scheduleLock = @fopen($scheduleLockPath, 'c+');
    $scheduleLocked = is_resource($scheduleLock) && @flock($scheduleLock, LOCK_EX | LOCK_NB);
    if (!$scheduleLocked) {
        if (is_file($schedulePath)) {
            send_schedule_binary($schedulePath, $key, (string)$city['name'], 'STALE_BUSY');
        }
        json_response(['ok' => false, 'city' => $key, 'error' => 'SCHEDULE_BUSY'], 503);
    }

    try {
        if (is_file($schedulePath) && time() - (int)@filemtime($schedulePath) <= $scheduleTtl) {
            send_schedule_binary($schedulePath, $key, (string)$city['name'], 'HIT_AFTER_LOCK');
        }

        $state = read_json_file($statePath);
        $serverToken = is_array($state) ? (int)($state['token'] ?? 0) : 0;
        $stateAge = is_array($state) ? time() - (int)($state['at'] ?? 0) : PHP_INT_MAX;

        if ($serverToken <= 0 || $stateAge > 300) {
            $ping = refresh_token($city, $statePath);
            if (!$ping['ok']) {
                if (is_file($schedulePath)) {
                    send_schedule_binary($schedulePath, $key, (string)$city['name'], 'STALE_PING_ERROR');
                }
                json_response([
                    'ok' => false,
                    'city' => $key,
                    'name' => $city['name'],
                    'error' => $ping['error'] ?? 'PING_FAILED',
                    'http' => $ping['http'] ?? 0,
                ], 502);
            }
            $serverToken = (int)$ping['token'];
        }

        $age = $serverToken + token_sum((string)$city['token']);
        $response = socket_request(
            service_url($city, 'GetScheduleFile'),
            (string)$age,
            0,
            67108864,
            45
        );

        if (is_unauthorized($response['body']) || $response['status'] === 401 || $response['status'] === 403) {
            $ping = refresh_token($city, $statePath);
            if ($ping['ok']) {
                $serverToken = (int)$ping['token'];
                $age = $serverToken + token_sum((string)$city['token']);
                $response = socket_request(
                    service_url($city, 'GetScheduleFile'),
                    (string)$age,
                    0,
                    67108864,
                    45
                );
            }
        }

        $body = $response['body'];
        $valid = $response['status'] >= 200
            && $response['status'] < 300
            && strlen($body) > 128
            && !is_unauthorized($body);

        if (!$valid) {
            if (is_file($schedulePath)) {
                send_schedule_binary($schedulePath, $key, (string)$city['name'], 'STALE_UPSTREAM_ERROR');
            }
            json_response([
                'ok' => false,
                'city' => $key,
                'name' => $city['name'],
                'error' => $response['error'] ?: (
                    is_unauthorized($body) ? 'Unauthorized access' : 'Schedule HTTP ' . $response['status']
                ),
                'http' => $response['status'],
            ], 502);
        }

        if (!atomic_binary_write($schedulePath, $body)) {
            json_response(['ok' => false, 'city' => $key, 'error' => 'SCHEDULE_CACHE_WRITE_FAILED'], 500);
        }

        send_schedule_binary($schedulePath, $key, (string)$city['name'], 'MISS');
    } finally {
        if (is_resource($scheduleLock)) {
            @flock($scheduleLock, LOCK_UN);
            @fclose($scheduleLock);
        }
    }
}

$cached = read_json_file($cachePath);
if ($action === 'vehicles' && is_array($cached) && time() - (int)($cached['cachedAt'] ?? 0) <= $cacheTtl) {
    $cached['cache'] = 'HIT';
    json_response($cached);
}

$lock = @fopen($lockPath, 'c+');
$locked = is_resource($lock) && @flock($lock, LOCK_EX | LOCK_NB);
if (!$locked) {
    if (is_array($cached)) {
        $cached['cache'] = 'STALE';
        json_response($cached);
    }
    json_response(['ok' => false, 'city' => $key, 'error' => 'CITY_BUSY'], 503);
}

try {
    // Another request may have refreshed the cache while this one waited.
    $cached = read_json_file($cachePath);
    if ($action === 'vehicles' && is_array($cached) && time() - (int)($cached['cachedAt'] ?? 0) <= $cacheTtl) {
        $cached['cache'] = 'HIT_AFTER_LOCK';
        json_response($cached);
    }

    $state = read_json_file($statePath);
    $serverToken = is_array($state) ? (int)($state['token'] ?? 0) : 0;
    $stateAge = is_array($state) ? time() - (int)($state['at'] ?? 0) : PHP_INT_MAX;

    if ($serverToken <= 0 || $stateAge > 300) {
        $ping = refresh_token($city, $statePath);
        if (!$ping['ok']) {
            json_response([
                'ok' => false,
                'city' => $key,
                'name' => $city['name'],
                'error' => $ping['error'] ?? 'PING_FAILED',
                'http' => $ping['http'] ?? 0,
            ], 502);
        }
        $serverToken = (int)$ping['token'];
    }

    if ($action === 'ping') {
        json_response([
            'ok' => true,
            'city' => $key,
            'name' => $city['name'],
            'serverToken' => $serverToken,
            'generatedAt' => gmdate('c'),
        ]);
    }

    $query = [
        'cNbLst' => '',
        'cIdLst' => '',
        'cRouteLst' => '',
        'cTrackLst' => '',
        'cDirLst' => '',
        'cKrsLst' => '',
    ];

    $age = $serverToken + token_sum((string)$city['token']);
    $response = socket_request(service_url($city, 'GetVehicles', $query), (string)$age);

    // Token can expire independently. Refresh and retry once.
    if (is_unauthorized($response['body']) || $response['status'] === 401 || $response['status'] === 403) {
        $ping = refresh_token($city, $statePath);
        if ($ping['ok']) {
            $serverToken = (int)$ping['token'];
            $age = $serverToken + token_sum((string)$city['token']);
            $response = socket_request(service_url($city, 'GetVehicles', $query), (string)$age);
        }
    }

    if ($response['status'] < 200 || $response['status'] >= 300 || is_unauthorized($response['body'])) {
        $error = $response['error'] ?: (is_unauthorized($response['body']) ? 'Unauthorized access' : 'HTTP ' . $response['status']);
        if (is_array($cached)) {
            $cached['ok'] = false;
            $cached['stale'] = true;
            $cached['error'] = $error;
            $cached['cache'] = 'STALE_ON_ERROR';
            json_response($cached);
        }
        json_response([
            'ok' => false,
            'city' => $key,
            'name' => $city['name'],
            'error' => $error,
            'http' => $response['status'],
        ], 502);
    }

    $vehicles = parse_vehicles($response['body']);
    $payload = [
        'ok' => true,
        'city' => $key,
        'name' => $city['name'],
        'center' => ['lat' => $city['lat'], 'lon' => $city['lon']],
        'vehicles' => $vehicles,
        'vehicleCount' => count($vehicles),
        'generatedAt' => gmdate('c'),
        'cachedAt' => time(),
        'cache' => 'MISS',
        'upstreamHttp' => $response['status'],
    ];
    atomic_json_write($cachePath, $payload);
    json_response($payload);
} finally {
    if (is_resource($lock)) {
        @flock($lock, LOCK_UN);
        @fclose($lock);
    }
}
