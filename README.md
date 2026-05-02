# LLM Papers Dashboard

一个用于浏览顶级 ML/NLP 会议 Oral 和 Spotlight 论文的在线仪表盘。

## 功能

- **论文浏览**：展示 2024-2026 年 ICLR、NeurIPS、ICML、ACL、EMNLP、COLM 六大顶会的 Oral/Spotlight 论文，共计 3900+ 篇
- **筛选与搜索**：按会议、年份筛选，支持关键词搜索（标题、作者、摘要、关键词等）
- **论文详情**：点击卡片查看完整标题、作者、摘要、TL;DR、关键词等信息
- **收藏功能**：标记感兴趣的论文，可一键筛选仅展示收藏论文
- **分页浏览**：支持自定义每页显示数量（10/20/50/100），可跳转到指定页码
- **数据导出**：将当前筛选结果导出为 JSONL 格式文件
- **状态记忆**：自动保存筛选条件、页码等状态，刷新页面后恢复

## 数据采集

项目包含两个 Python 脚本用于获取论文数据：

- `scripts/fetch_papers.py`：从 OpenReview API 获取 ICLR/NeurIPS/ICML/COLM 论文，从 ACL Anthology 获取 ACL/EMNLP 论文
- `scripts/translate_papers.py`：调用 LLM API 将论文标题和摘要翻译为中文（支持并发、断点续传）

## 在线访问

👉 [https://galenchen320.github.io/LLMPapers](https://galenchen320.github.io/LLMPapers)

## 致谢

数据来源：[OpenReview](https://openreview.net/)、[ACL Anthology](https://aclanthology.org/)
