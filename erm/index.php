<?php
// ERM - PHP Environment Wrapper for Localhost / Intranet Apache Server
session_start();

$loggedInUser = $_SESSION['user'] ?? '';
$isAdmin = !empty($_SESSION['user']) && (int)($_SESSION['expire'] ?? 0) >= time();

// If user wants to logout via PHP
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    header('Location: index.php');
    exit;
}

// Load HTML content
$html = file_get_contents(__DIR__ . '/index.html');

// Inject window.PHP_AUTH script before </head>
$authScript = '<script>
  window.PHP_AUTH = {
    isAdmin: ' . json_encode($isAdmin) . ',
    userName: ' . json_encode($loggedInUser) . '
  };
</script>
</head>';

$output = str_replace('</head>', $authScript, $html);
echo $output;
