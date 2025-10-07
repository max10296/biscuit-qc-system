# ==============================================
#  Script: upload_to_github.ps1
#  Author: Abdallah
#  Purpose: Delete old Git config, reinitialize repo, and force push all files to GitHub
# ==============================================

# إعداد المتغيرات
$repoUrl = "https://github.com/max10296/biscuit-qc-system.git"
$projectPath = "C:\Users\abdal\Downloads\biscuit-qc-system-main"

Write-Host "🔄 Starting GitHub re-upload process..." -ForegroundColor Cyan

# الانتقال إلى مجلد المشروع
Set-Location $projectPath

# حذف مجلد .git لو موجود
if (Test-Path ".git") {
    Write-Host "🗑️ Removing old .git folder..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force ".git"
}

# تهيئة المستودع من جديد
Write-Host "🚀 Initializing new git repository..."
git init
git branch -M main
git remote add origin $repoUrl

# إضافة جميع الملفات
Write-Host "📦 Adding all project files..."
git add .

# إنشاء commit جديد
Write-Host "📝 Creating new commit..."
git commit -m "Re-upload project with clean files"

# رفع الملفات إلى GitHub بقوة (يستبدل النسخة القديمة)
Write-Host "☁️ Pushing files to GitHub..."
git push -u origin main --force

# فتح الريبو في المتصفح بعد الرفع
Write-Host "🌍 Opening GitHub repository..."
Start-Process $repoUrl

Write-Host "✅ Done! Your project has been re-uploaded successfully." -ForegroundColor Green
