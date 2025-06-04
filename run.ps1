# 检查并清理旧的虚拟环境
if (Test-Path "venv") {
    Write-Host "Removing old virtual environment..."
    Remove-Item -Recurse -Force venv
}

Write-Host "Creating new virtual environment..."
python -m venv venv

# 激活虚拟环境
Write-Host "Activating virtual environment..."
.\venv\Scripts\Activate.ps1

# 升级pip
Write-Host "Upgrading pip..."
python -m pip install --upgrade pip

# 安装依赖
Write-Host "Installing dependencies..."
pip install -r requirements.txt

# 运行应用
Write-Host "Starting the application..."
python app.py
