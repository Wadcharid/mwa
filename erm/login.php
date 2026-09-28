<?php
// ERM - LDAP Active Directory Authentication (โครงสร้างจาก login.txt)
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');

session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => $isHttps,
    'httponly' => true,
    'samesite' => 'Lax',
]);

session_start();

function h($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function ldap_filter_escape_safe($value) {
    if (function_exists('ldap_escape')) {
        return ldap_escape($value, '', LDAP_ESCAPE_FILTER);
    }
    return str_replace(
        ['\\', '*', '(', ')', "\x00"],
        ['\\5c', '\\2a', '\\28', '\\29', '\\00'],
        $value
    );
}

$returnUrl = 'index.php';
$msg = '';

// ตรวจสอบสถานะการล็อกอินเดิม
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && !empty($_SESSION['user']) && (int)($_SESSION['expire'] ?? 0) >= time()) {
    header('Location: ' . $returnUrl);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = (string)($_POST['password'] ?? '');

    // รองรับ admin / admin เผื่อกรณีทดสอบแบบออฟไลน์
    if ($username === 'admin' && $password === 'admin') {
        session_regenerate_id(true);
        $_SESSION['user'] = 'ผู้ดูแลระบบ (Admin)';
        $_SESSION['dept'] = 'ศูนย์ควบคุม ERM';
        $_SESSION['is_admin'] = true;
        $_SESSION['expire'] = time() + (480 * 60);
        header('Location: ' . $returnUrl);
        exit;
    }

    if ($username === '' || $password === '') {
        $msg = 'กรุณากรอก Username และ Password';
    } else {
        $adServer = 'water.mwa';
        $ldap = @ldap_connect($adServer);

        if (!$ldap) {
            $msg = 'ไม่สามารถเชื่อมต่อระบบ AD (water.mwa) ได้';
        } else {
            ldap_set_option($ldap, LDAP_OPT_PROTOCOL_VERSION, 3);
            ldap_set_option($ldap, LDAP_OPT_REFERRALS, 0);

            $ldaprdn = $username . '@water.mwa';
            $bind = @ldap_bind($ldap, $ldaprdn, $password);

            if ($bind) {
                $safeUsername = ldap_filter_escape_safe($username);
                $filter = "(sAMAccountName={$safeUsername})";

                $result = @ldap_search(
                    $ldap,
                    'dc=water,dc=mwa',
                    $filter,
                    ['cn', 'department', 'samaccountname']
                );

                if ($result) {
                    $info = @ldap_get_entries($ldap, $result);

                    if ($info && isset($info['count']) && $info['count'] > 0) {
                        session_regenerate_id(true);

                        // บันทึกเฉพาะชื่อผู้รายงานตามข้อกำหนด
                        $_SESSION['user'] = $info[0]['cn'][0] ?? $username;
                        $_SESSION['dept'] = $info[0]['department'][0] ?? '';
                        $_SESSION['is_admin'] = true;
                        $_SESSION['expire'] = time() + (480 * 60);

                        @ldap_close($ldap);

                        header('Location: ' . $returnUrl);
                        exit;
                    } else {
                        $msg = 'ไม่พบข้อมูลผู้ใช้ในระบบ AD';
                    }
                } else {
                    $msg = 'ไม่สามารถค้นหาข้อมูลผู้ใช้ได้';
                }
                @ldap_close($ldap);
            } else {
                @ldap_close($ldap);
                $msg = 'Username หรือ Password ไม่ถูกต้อง';
            }
        }
    }
}
?>
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>เข้าสู่ระบบ ERM (AD Login)</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            font-family: 'Prompt', sans-serif;
            background: #0b1120;
            color: #f8fafc;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
        }
        .login-card {
            background: #131d33;
            border: 1px solid rgba(56, 189, 248, 0.2);
            border-radius: 12px;
            padding: 32px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
        }
        .login-header {
            text-align: center;
            margin-bottom: 24px;
        }
        .login-header h1 {
            font-size: 1.3rem;
            color: #fff;
            margin: 8px 0 4px;
        }
        .login-header p {
            font-size: 0.8rem;
            color: #94a3b8;
        }
        .form-group {
            margin-bottom: 16px;
        }
        .form-label {
            display: block;
            font-size: 0.82rem;
            color: #cbd5e1;
            margin-bottom: 6px;
        }
        .form-input {
            width: 100%;
            box-sizing: border-box;
            background: #0f172a;
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 6px;
            color: #fff;
            font-family: inherit;
            font-size: 0.9rem;
            padding: 10px 12px;
            outline: none;
        }
        .form-input:focus {
            border-color: #38bdf8;
        }
        .btn-submit {
            width: 100%;
            background: linear-gradient(135deg, #0284c7, #2563eb);
            color: #fff;
            border: none;
            padding: 10px;
            font-family: inherit;
            font-size: 0.95rem;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            margin-top: 8px;
        }
        .btn-submit:hover {
            background: linear-gradient(135deg, #0369a1, #1d4ed8);
        }
        .alert-error {
            background: rgba(239, 68, 68, 0.15);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 0.82rem;
            margin-bottom: 16px;
        }
        .btn-back {
            display: block;
            text-align: center;
            margin-top: 16px;
            font-size: 0.8rem;
            color: #94a3b8;
            text-decoration: none;
        }
        .btn-back:hover {
            color: #38bdf8;
        }
    </style>
</head>
<body>

<div class="login-card">
    <div class="login-header">
        <div style="font-size: 2.2rem;">🛰️</div>
        <h1>เข้าสู่ระบบ ERM</h1>
        <p>ใช้รหัส AD (การประปานครหลวง) หรือ รหัสผู้ดูแล</p>
    </div>

    <?php if ($msg !== ''): ?>
        <div class="alert-error"><?= h($msg) ?></div>
    <?php endif; ?>

    <form method="POST" action="">
        <div class="form-group">
            <label class="form-label" for="username">Username (รหัสพนักงาน)</label>
            <input type="text" id="username" name="username" class="form-input" placeholder="เช่น 00100xxx หรือ admin" required autofocus>
        </div>
        <div class="form-group">
            <label class="form-label" for="password">Password</label>
            <input type="password" id="password" name="password" class="form-input" placeholder="••••••••" required>
        </div>
        <button type="submit" class="btn-submit">เข้าสู่ระบบ</button>
    </form>

    <a href="index.php" class="btn-back">⬅️ กลับสู่หน้าแผนที่</a>
</div>

</body>
</html>
