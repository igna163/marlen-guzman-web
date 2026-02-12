@echo off
echo Registering...
curl -s -X POST https://marlen-guzman-web.onrender.com/api/register -H "Content-Type: application/json" -d "{\"email\":\"TEST.BATCH@EXAMPLE.COM\", \"password\":\"123\", \"username\":\"batchuser%RANDOM%\", \"nombre_completo\":\"Batch User\", \"telefono\":\"123456\"}"
echo.
echo Logging in (Lowercase)...
curl -s -X POST https://marlen-guzman-web.onrender.com/api/login -H "Content-Type: application/json" -d "{\"email\":\"test.batch@example.com\", \"password\":\"123\"}"
echo.
echo Logging in (Mixed)...
curl -s -X POST https://marlen-guzman-web.onrender.com/api/login -H "Content-Type: application/json" -d "{\"email\":\"Test.Batch@Example.Com\", \"password\":\"123\"}"
echo.
