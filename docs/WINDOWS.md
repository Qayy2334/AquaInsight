# 在 Windows 上运行 AquaInsight

## 你需要准备

- Windows 10 64 位（22H2 及以上）或 Windows 11
- 已安装 **Docker Desktop**：<https://www.docker.com/products/docker-desktop/>
  安装时保持默认的 **WSL 2** 选项。装好后打开 Docker Desktop，等左下角显示 **Engine running**。
- 空闲端口：8080（网页）、8000（接口）、3307（数据库）

## 启动

1. 解压项目文件夹（路径里尽量不要有中文和空格，例如 `C:\AquaInsight`）
2. 双击 **`start-windows.bat`**
3. 第一次启动需要几分钟，完成后会自动打开浏览器 <http://localhost:8080>
4. 点击 **Sign Up** 注册账号，注册后自动登录进入系统

系统第一次启动时会自动建库，并导入土门水厂 2026-08-01 至 2026-09-30 的 61 天记录。

## 两种安装包

| 收到的文件 | 第一次启动 | 是否需要联网 |
|---|---|---|
| 项目文件夹 + `docker-images\` 文件夹（离线包） | 脚本自动导入镜像，约 2–5 分钟 | 不需要 |
| 只有项目文件夹 | 自动下载并构建，约 5–15 分钟 | 需要 |

离线包里的镜像是 x86-64（amd64）架构，适用于绝大多数 Intel / AMD 电脑。

## 日常使用

| 操作 | 方法 |
|---|---|
| 启动 | 双击 `start-windows.bat` |
| 停止（保留数据） | 双击 `stop-windows.bat` |
| 清空所有数据重新开始 | 双击 `reset-windows.bat`，输入 `YES` 确认 |

关机或重启电脑后，先打开 Docker Desktop，再双击 `start-windows.bat`。

## 常见问题

**提示 Docker Desktop is not running**
打开 Docker Desktop，等到显示 Engine running 后再运行脚本。

**端口被占用（8080 / 8000 / 3307）**
用记事本打开项目里的 `.env`（第一次启动后自动生成），修改：

```
FRONTEND_PORT=8081
BACKEND_PORT=8001
MYSQL_PORT=3308
```

保存后重新双击 `start-windows.bat`，浏览器地址也会跟着变成新的端口。

**等了 3 分钟提示没有响应**
在 Docker Desktop 的 Containers 页面打开 `water_frontend` / `aquainsight` 项目，查看 backend 的日志。
第一次启动时后端要导入数据并训练模型，较慢的电脑可能需要更久，可以稍等后直接访问 <http://localhost:8080>。

**Docker Desktop 提示需要开启虚拟化或 WSL**
按 Docker Desktop 的提示在 BIOS 中开启虚拟化（Intel VT-x / AMD-V），或在管理员 PowerShell 中运行
`wsl --install` 后重启电脑。

## 用数据库工具查看数据

MySQL 运行在容器中，可以用 Navicat、DBeaver、MySQL Workbench 连接：

- 主机 `localhost`，端口 `3307`
- 数据库 `water_quality`
- 用户名 `water`，密码 `water`（可在 `.env` 中修改，修改后需运行 `reset-windows.bat` 才会生效）

## 给打包的人：生成离线包

在 Mac（含 Apple 芯片）或 Linux 上，于项目根目录运行：

```bash
./scripts/build-windows-images.sh
```

会在 `docker-images/` 下生成三个镜像文件（backend、frontend、mysql，共约 410 MB）。
然后生成发给对方的压缩包（只包含已提交的代码，加上镜像文件）：

```bash
git archive -o aquainsight-windows.zip HEAD
zip -r aquainsight-windows.zip docker-images
```

对方解压后双击 `start-windows.bat` 即可。
