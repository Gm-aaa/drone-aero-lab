# 无人机空气动力学实验室 (drone-aero-lab)

纯前端 Three.js 项目，用于学习无人机各部件结构与空气动力学（教学示意级）。
当前已实现多旋翼竖切：四/六/八轴结构展示，可调迎角、材料、风速、风向，实时示意升力与气流。

## 开发
```bash
npm install
npm run dev     # http://localhost:5173/drone-aero-lab/
npm test        # 运行空气动力学单测
```

## 部署
推送到 `main` 分支即由 GitHub Actions 自动构建并发布到 GitHub Pages。
需在仓库 Settings → Pages → Source 选择 **GitHub Actions**。

> 空气动力学为教学示意级简化模型，数值为示意，非精确工程值。
