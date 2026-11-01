# AquaInsight · 地下水水质预测与异常检测系统

AquaInsight 是一个基于机器学习的地下水处理厂水质分析平台（CAT405 毕业设计，Wu Bingying）。
它读取水厂的每日处理记录，提供历史趋势分析、次日出水水质预测和异常记录检测。

- **历史趋势**：浊度、pH、次氯酸钠投加量、游离氯等 6 项指标的趋势、分布和相关性
- **次日预测**：用当天的 6 项测量值预测第二天的出水浊度、pH 和游离氯（Linear Regression / Random Forest）
- **模型测试与评估**：按时间切分的测试集、时间序列交叉验证、与朴素基线对比
- **异常检测**：IQR 与 Isolation Forest 两种方法，标出与历史规律不同的日期及原因
- **按天管理数据**：导入 Excel / CSV / Word 表格，单天新增、修改、删除，保留修改历史
- **账号登录**：用户名 + 密码注册登录

系统第一次启动时，会自动导入土门地下水厂 2026-08-01 至 2026-09-30 的 61 天记录。

---

## 目录

1. [在 Windows 上安装 Docker Desktop](#1-在-windows-上安装-docker-desktop)
2. [把项目下载到本地](#2-把项目下载到本地)
3. [启动项目](#3-启动项目)
4. [开始使用](#4-开始使用)
5. [停止、重启与清空数据](#5-停止重启与清空数据)
6. [常见问题](#6-常见问题)
7. [macOS / Linux](#7-macos--linux)
8. [技术说明](#8-技术说明)

---

## 1. 在 Windows 上安装 Docker Desktop

整个系统（网页、后端、MySQL 数据库）都运行在 Docker 里，**不需要**另外安装 Python、Node.js 或 MySQL。

### 1.1 检查电脑是否满足要求

- Windows 10 64 位（版本 22H2 或更高）或 Windows 11
- 至少 8 GB 内存，10 GB 以上可用磁盘空间
- 已开启 CPU 虚拟化：按 `Ctrl + Shift + Esc` 打开**任务管理器** → **性能** → **CPU**，
  右下角的“虚拟化”应显示**已启用**。如果显示“已禁用”，需要重启进入 BIOS 开启
  Intel VT-x 或 AMD-V（不同品牌电脑进入 BIOS 的按键不同，常见为 `F2`、`F10`、`Del`）。

### 1.2 安装 WSL 2

Docker Desktop 在 Windows 上通过 WSL 2 运行。在开始菜单搜索 **PowerShell**，右键选择
**以管理员身份运行**，执行：

```powershell
wsl --install
```

完成后**重启电脑**。如果提示 WSL 已安装，可以执行 `wsl --update` 更新到最新版本。

### 1.3 下载并安装 Docker Desktop

1. 打开 Docker 官网下载页：<https://www.docker.com/products/docker-desktop/>
2. 点击 **Download for Windows**，下载 `Docker Desktop Installer.exe`
   （大多数电脑选择 AMD64 版本；只有 ARM 架构的 Windows 设备才选 ARM64）
3. 双击安装，保持默认勾选的 **Use WSL 2 instead of Hyper-V**
4. 安装完成后按提示注销或重启电脑

### 1.4 确认 Docker 可以正常运行

1. 从开始菜单打开 **Docker Desktop**，接受服务条款（登录账号可以跳过）
2. 等待左下角显示 **Engine running**（绿色）
3. 打开 PowerShell，执行：

```powershell
docker --version
docker compose version
```

两条命令都能显示版本号，说明安装成功。

---

## 2. 把项目下载到本地

> 建议把项目放在**路径中没有中文和空格**的位置，例如 `C:\Projects\AquaInsight`。

### 方式 A：用 Git 克隆（推荐）

先安装 Git：<https://git-scm.com/download/win>（一路默认安装即可）。然后打开 PowerShell：

```powershell
mkdir C:\Projects
cd C:\Projects
git clone <仓库地址> AquaInsight
cd AquaInsight
```

> `<仓库地址>` 替换为项目在 GitHub / GitLab 上的地址，例如
> `https://github.com/<用户名>/<仓库名>.git`。

以后项目有更新时，在项目文件夹里执行 `git pull` 即可获取最新代码。

### 方式 B：下载 ZIP 压缩包

- 在 GitHub 仓库页面点击 **Code → Download ZIP**，或直接使用别人发给你的压缩包
- 解压到 `C:\Projects\AquaInsight`
- 确认解压后的文件夹里能直接看到 `docker-compose.yml` 和 `start-windows.bat`
  （而不是又套了一层文件夹）

如果收到的压缩包里还有一个 **`docker-images`** 文件夹，那是**离线镜像包**，
启动时不需要联网下载依赖，见下一节。

---

## 3. 启动项目

先确认 Docker Desktop 已经打开，并显示 **Engine running**。

### 方式 A：双击启动（推荐）

在项目文件夹中双击 **`start-windows.bat`**。脚本会自动：

1. 检查 Docker 是否已安装并在运行
2. 第一次运行时根据 `.env.example` 生成配置文件 `.env`
3. 如果存在 `docker-images` 离线镜像包，先导入镜像
4. 启动网页、后端和数据库三个容器
5. 等系统准备就绪后，自动在浏览器打开 <http://localhost:8080>

| 情况 | 第一次启动大约需要 |
|---|---|
| 有 `docker-images` 离线镜像包 | 2–5 分钟，不需要联网 |
| 没有离线包 | 5–15 分钟，需要联网下载并构建镜像 |

之后再启动只需要几秒钟。

### 方式 B：命令行启动

在项目文件夹打开 PowerShell（文件资源管理器地址栏输入 `powershell` 回车即可）：

```powershell
docker compose up -d --build
```

看到三个容器都显示 `Started` 后，等待约半分钟，在浏览器打开 <http://localhost:8080>。

查看运行状态和日志：

```powershell
docker compose ps
docker compose logs -f backend
```

---

## 4. 开始使用

| 地址 | 内容 |
|---|---|
| <http://localhost:8080> | 首页，点击 **Get started** 或 **Sign in** 进入系统 |
| <http://localhost:8080/dashboard> | 系统主界面（需要登录） |
| <http://localhost:8000/docs> | 后端接口文档（Swagger） |

1. 第一次使用点击 **Sign Up** 注册账号：
   用户名 3–32 位（字母、数字、`.`、`-`、`_`），密码至少 6 位
2. 注册后自动登录，进入 Dashboard
3. 左侧导航：

| 页面 | 功能 |
|---|---|
| Dashboard | 单日视图：选择日期查看当天各项指标、仪表盘、异常提示 |
| Historical Trends | 趋势图、分布、箱线图、相关性热力图、散点图、描述统计 |
| Next-day Prediction | 基于最后一天数据对下一天的预测 |
| Model Testing | 模型在测试期的真实值与预测值对比 |
| Anomaly Detection | IQR 与 Isolation Forest 的异常检测结果，可调参数重跑 |
| Model Evaluation | 四个模型的指标对比、交叉验证、特征影响，可导出 CSV |
| Data Management | 导入文件、按天新增 / 修改 / 删除记录、查看修改历史、导出数据 |

### 导入新的数据

在 **Data Management** 中拖入 Excel / CSV / Word 文件。系统先显示预览：

- **新的日期**：直接加入
- **数值不同的日期**：显示旧值与新值，勾选后才会覆盖
- **完全相同的日期**：自动跳过

确认导入后，系统会自动重新训练模型并重跑异常检测。文件中每行一天，表头可以是中文或英文：

| 日期项目 / Date | 入水浑浊度NTU | 入水pH | 次氯酸钠药剂投加（mg/千吨水） | 出水浑浊度NTU | 出水pH | 出水游离氯mg/L |
|---|---|---|---|---|---|---|

---

## 5. 停止、重启与清空数据

| 操作 | 双击脚本 | 或执行命令 |
|---|---|---|
| 启动 | `start-windows.bat` | `docker compose up -d` |
| 停止（保留数据） | `stop-windows.bat` | `docker compose down` |
| 清空所有数据重新开始 | `reset-windows.bat`（输入 `YES` 确认） | `docker compose down -v` |
| 更新代码后重新构建 | — | `docker compose up -d --build` |

- 关机或重启电脑后，先打开 Docker Desktop，再运行 `start-windows.bat`
- **清空数据**会删除所有账号、手动修改过的记录和分析结果；下次启动会重新导入原始的 61 天记录

---

## 6. 常见问题

**提示 “Docker Desktop is not running”**
打开 Docker Desktop，等左下角显示 Engine running 后再运行脚本。

**Docker Desktop 启动报错 “WSL 2 installation is incomplete” 或虚拟化相关错误**
按第 1.1、1.2 节检查虚拟化是否开启，并以管理员身份执行 `wsl --update` 后重启电脑。

**端口被占用（8080 / 8000 / 3307）**
用记事本打开项目里的 `.env`（第一次启动后自动生成，或手动复制 `.env.example` 并改名为 `.env`），修改：

```
FRONTEND_PORT=8081
BACKEND_PORT=8001
MYSQL_PORT=3308
```

保存后重新启动，网页地址随之变为 `http://localhost:8081`。

**第一次构建时下载很慢或失败**
构建需要从 Docker Hub、PyPI、npm 下载内容。可以在 Docker Desktop 的
**Settings → Docker Engine** 中配置镜像加速地址，或向项目提供者索要包含 `docker-images` 的离线包。

**网页打开后提示 502 或一直加载**
后端第一次启动需要导入数据并训练模型，稍等半分钟再刷新。仍有问题时执行
`docker compose logs backend` 查看日志。

**`.bat` 双击后窗口一闪而过**
在项目文件夹打开 PowerShell，执行 `.\start-windows.bat`，可以看到具体的报错信息。

**用数据库工具查看数据**
用 Navicat、DBeaver 或 MySQL Workbench 连接：主机 `localhost`，端口 `3307`，
数据库 `water_quality`，用户名 `water`，密码 `water`（可在 `.env` 中修改，
修改后需执行 `docker compose down -v` 重建数据库才会生效）。

更多 Windows 细节见 [docs/WINDOWS.md](docs/WINDOWS.md)。

---

## 7. macOS / Linux

安装 Docker Desktop（macOS）或 Docker Engine + Compose 插件（Linux），然后在项目文件夹执行：

```bash
cp .env.example .env    # 可选，默认值即可运行
docker compose up -d --build
```

停止：`docker compose down`；清空数据：`docker compose down -v`。

### 为 Windows 生成离线镜像包

在 macOS（包括 Apple 芯片）或 Linux 上执行：

```bash
./scripts/build-windows-images.sh
git archive -o aquainsight-windows.zip HEAD
zip -r aquainsight-windows.zip docker-images
```

会生成 x86-64 架构的后端、前端和 MySQL 镜像（约 410 MB），与代码一起打包成 `aquainsight-windows.zip`。

---

## 8. 技术说明

### 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18、TypeScript、Vite、Tailwind CSS v4、ECharts、TanStack Query、React Router |
| 后端 | FastAPI、SQLAlchemy 2、pandas、scikit-learn、bcrypt、PyJWT |
| 数据库 | MySQL 8 |
| 部署 | Docker Compose：nginx 提供前端页面并把 `/api` 转发给后端 |

### 配置项（`.env`）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `FRONTEND_PORT` | 8080 | 网页端口 |
| `BACKEND_PORT` | 8000 | 后端接口端口 |
| `MYSQL_PORT` | 3307 | 数据库对外端口 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | water / water | 数据库账号 |
| `MYSQL_ROOT_PASSWORD` | rootpass | 数据库 root 密码 |
| `JWT_SECRET` | 开发用默认值 | 登录令牌签名密钥，部署到他人可访问的环境时务必修改 |
| `SEED_DEMO_DATA` | false | 原始数据文件不存在时，是否生成模拟数据 |

### 方法概要

- **预测**：特征为第 *t* 天的 6 项测量值，目标为第 *t+1* 天的出水浊度 / pH / 游离氯，
  只使用真正相邻的两天。按时间 80/20 切分，并做 5 折扩展窗口时间序列交叉验证；
  指标为 MAE、RMSE、R²，同时与“明天 = 今天”“历史均值”两个朴素基线对比。
- **异常检测**：每个变量单独做 IQR（默认 k = 1.5），以及对标准化后的 6 个变量做 Isolation Forest
  （默认 contamination = 0.05）。被标记只表示与历史规律不同，不代表水质不安全。
- **数据清洗**：识别中英文表头，解析 `2026.8.1` 等日期格式，修正 `7,58` 这类小数点录入错误，
  同一天重复时保留第一行。缺失值在数据库中保留为空，仅在建模和 Isolation Forest 时按时间插值。

### 本地开发

```bash
# 后端（可用 SQLite 快速调试）
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
DATABASE_URL=sqlite:///./dev.db MODEL_DIR=./artifacts SEED_FILE=seed_data/tumen_groundwater_2026-08_09.docx \
  uvicorn app.main:app --reload

# 前端（/api 自动转发到 localhost:8000）
cd frontend
npm install
npm run dev     # http://localhost:5173
```

### 测试

```bash
cd backend
pip install -r requirements-dev.txt
pytest -q
```

测试用例与结果见 [docs/TEST_CASES.md](docs/TEST_CASES.md)，实验结果、讨论与局限性见 [docs/RESULTS.md](docs/RESULTS.md)。

### 项目结构

```
├── docker-compose.yml          三个服务：mysql、backend、frontend
├── .env.example                配置模板
├── start-windows.bat           Windows 一键启动
├── stop-windows.bat            Windows 停止
├── reset-windows.bat           Windows 清空数据
├── scripts/
│   └── build-windows-images.sh 生成 x86-64 离线镜像包
├── backend/
│   ├── app/
│   │   ├── main.py             启动、建表、导入初始数据
│   │   ├── models.py           数据表定义
│   │   ├── routers/            接口：auth、records、analysis、predictions、anomalies、dashboard、exports
│   │   └── services/           业务逻辑：preprocess、records、eda、ml、anomaly、auth
│   ├── seed_data/              土门水厂原始记录（Word 表格）
│   └── tests/                  pytest 测试
├── frontend/
│   └── src/
│       ├── pages/              Landing、Auth、Overview(Dashboard)、Trends、Prediction、ModelTesting、
│       │                       Anomalies、Evaluation、DataManagement
│       ├── components/         Layout、Chart、DatePicker、DateCalendar、ui
│       └── api/client.ts       接口调用与登录状态
└── docs/
    ├── WINDOWS.md              Windows 详细说明
    ├── RESULTS.md              实验结果与讨论
    └── TEST_CASES.md           测试用例
```
