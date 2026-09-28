<?php
// get_turbidity.php - API Endpoint for fetching Turbidity (ความขุ่น) from MWA RWC
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$cacheFile = __DIR__ . '/data/turbidity_cache.json';
$cacheTTL = 180; // 3 minutes cache

// Check cache
if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTTL)) {
    $cached = file_get_contents($cacheFile);
    if (!empty($cached)) {
        echo $cached;
        exit;
    }
}

// Target stations definition
$targetStations = [
    'S16' => ['id' => 'S16', 'search_name' => 'แม่น้ำแควน้อย', 'name' => 'แควน้อย'],
    'T5'  => ['id' => 'T5',  'search_name' => 'แม่น้ำแควใหญ่', 'name' => 'แควใหญ่'],
    'S11' => ['id' => 'S11', 'search_name' => 'เขื่อนแม่กลอง', 'name' => 'แม่กลอง'],
    'S9'  => ['id' => 'S9',  'search_name' => 'ท่าม่วง',        'name' => 'ท่าม่วง'],
    'S12' => ['id' => 'S12', 'search_name' => 'บางเลน กม.35',   'name' => 'บางเลน กม.35'],
    'S14' => ['id' => 'S14', 'search_name' => 'คลองตะวันตก กม.14', 'name' => 'คลองตะวันตก กม.14']
];

$url = 'http://rwc.mwa.co.th/page/home/table.php';
$options = [
    'http' => [
        'method' => 'GET',
        'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\nAccept: text/html, */*\r\n",
        'timeout' => 8
    ]
];

$context = stream_context_create($options);
$html = @file_get_contents($url, false, $context);

$extracted = [];
$updateTime = date('H:i');
$updateDate = date('d/m/Y');

if ($html !== false && strlen($html) > 500) {
    // Extract rows
    preg_match_all('/<TR>(.*?)<\/TR>/si', $html, $rowMatches);
    $rows = $rowMatches[1] ?? [];

    foreach ($targetStations as $key => $st) {
        $found = false;
        foreach ($rows as $row) {
            // Check if station ID or search name matches row
            if (stripos($row, 'id=' . $st['id']) !== false || stripos($row, $st['search_name']) !== false) {
                // Match table cells
                preg_match_all('/<TD.*?>(.*?)<\/TD>/si', $row, $colMatches);
                $cols = $colMatches[1] ?? [];
                
                // Usually column index:
                // 0: Station, 1: Distance, 2: Date, 3: Time, 4: pH, 5: Salinity, 6: Turbidity
                if (count($cols) >= 7) {
                    $rowDate = trim(strip_tags($cols[2] ?? ''));
                    $rowTime = trim(strip_tags($cols[3] ?? ''));
                    $turbidRaw = trim(strip_tags($cols[6] ?? '-'));
                    
                    if (!empty($rowTime)) $updateTime = $rowTime;
                    if (!empty($rowDate)) $updateDate = $rowDate;

                    $turbidVal = is_numeric($turbidRaw) ? floatval($turbidRaw) : null;
                    $isHigh = ($turbidVal !== null && $turbidVal > 100);

                    $extracted[$key] = [
                        'id' => $st['id'],
                        'name' => $st['name'],
                        'turbidity' => $turbidVal,
                        'raw_turbidity' => $turbidRaw,
                        'is_high' => $isHigh,
                        'date' => $rowDate,
                        'time' => $rowTime
                    ];
                    $found = true;
                    break;
                }
            }
        }
        
        if (!$found) {
            $extracted[$key] = [
                'id' => $st['id'],
                'name' => $st['name'],
                'turbidity' => null,
                'raw_turbidity' => '-',
                'is_high' => false,
                'date' => $updateDate,
                'time' => $updateTime
            ];
        }
    }

    $response = [
        'status' => 'success',
        'source' => 'live',
        'date' => $updateDate,
        'time' => $updateTime,
        'updated_at' => date('Y-m-d H:i:s'),
        'data' => array_values($extracted)
    ];

    $jsonResult = json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
    // Save to cache
    @file_put_contents($cacheFile, $jsonResult);
    echo $jsonResult;
    exit;
}

// Fallback: If live fetch failed, try stale cache or default fallback data
if (file_exists($cacheFile)) {
    $stale = file_get_contents($cacheFile);
    if (!empty($stale)) {
        $decoded = json_decode($stale, true);
        if ($decoded) {
            $decoded['source'] = 'stale_cache';
            echo json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            exit;
        }
    }
}

// Static fallback if everything else fails
$fallback = [
    'status' => 'fallback',
    'source' => 'default',
    'date' => $updateDate,
    'time' => $updateTime,
    'updated_at' => date('Y-m-d H:i:s'),
    'data' => [
        ['id' => 'S16', 'name' => 'แควน้อย', 'turbidity' => 664.0, 'raw_turbidity' => '664', 'is_high' => true, 'date' => $updateDate, 'time' => $updateTime],
        ['id' => 'T5',  'name' => 'แควใหญ่', 'turbidity' => 481.0, 'raw_turbidity' => '481', 'is_high' => true, 'date' => $updateDate, 'time' => $updateTime],
        ['id' => 'S11', 'name' => 'แม่กลอง', 'turbidity' => 362.0, 'raw_turbidity' => '362', 'is_high' => true, 'date' => $updateDate, 'time' => $updateTime],
        ['id' => 'S9',  'name' => 'ท่าม่วง',  'turbidity' => 70.0,  'raw_turbidity' => '70',  'is_high' => false, 'date' => $updateDate, 'time' => $updateTime],
        ['id' => 'S12', 'name' => 'บางเลน กม.35', 'turbidity' => 28.5, 'raw_turbidity' => '28.5', 'is_high' => false, 'date' => $updateDate, 'time' => $updateTime],
        ['id' => 'S14', 'name' => 'คลองตะวันตก กม.14', 'turbidity' => 36.1, 'raw_turbidity' => '36.1', 'is_high' => false, 'date' => $updateDate, 'time' => $updateTime]
    ]
];
echo json_encode($fallback, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
