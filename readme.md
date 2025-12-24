# 📦 CodeCache Pro

**Speed up your downloads!** Cache npm and Python packages on your local network so your team downloads them super fast.


## ⚡ What It Does

- **Caches npm & Python packages** - Download once, use everywhere
- **Saves bandwidth** - No more downloading the same packages over and over
- **Works on Windows** - Easy setup as a Windows service
- **Web dashboard** - See what's cached and how much you've saved
- **Auto cleanup** - Manages storage automatically

---

## 🚀 Quick Setup (Windows)

1. **Install Node.js** from [nodejs.org](https://nodejs.org/)
2. **Download this project** to your computer
3. **Run as Admin** and execute:
   ```powershell
   cd scripts
   .\install-service.ps1
   ```
4. **Done!** Your cache server is running on port 5050

## 🔧 Use Your Cache

**For npm:**
```bash
npm config set registry http://YOUR_SERVER_IP:5050/npm
```

**For Python:**
```bash
pip config set global.index-url http://YOUR_SERVER_IP:5050/pypi
```

## 🛠️ Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express + SQLite
- **Deployment**: GitHub Pages (auto-deploy)

## 📁 Project Structure

```
codeCachePro/
├── frontend/    # React dashboard
├── backend/     # Cache server
├── cli/         # Command tools
└── scripts/     # Windows installer
```

---