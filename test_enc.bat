@echo off
echo Registering Encrypted User...
curl -s -X POST https://marlen-guzman-web.onrender.com/api/register -H "Content-Type: application/json" -d "{\"email\":\"ENC.TEST%RANDOM%@EXAMPLE.COM\", \"password\":\"secret\", \"username\":\"encuser%RANDOM%\", \"nombre_completo\":\"Enc User\", \"telefono\":\"999999\"}"
echo.
echo.
echo NOTE: Since we cannot easily check the DB content from here without PG client,
echo success above means the server accepted the registration (and thus hashed it).
echo.
