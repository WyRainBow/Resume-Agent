#!/usr/bin/env python3
"""
测试并行分块处理的性能对比
"""

import asyncio
import time
import sys
from pathlib import Path

# 添加项目根目录到路径
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from llm import call_llm, DEFAULT_AI_PROVIDER
from chunk_processor import split_resume_text, merge_resume_chunks
from parallel_chunk_processor import ParallelChunkProcessor


# 测试用的长简历文本
TEST_RESUME = """
张三
电话：13800138000 | 邮箱：zhangsan@example.com | 地址：北京市海淀区

求职意向：高级软件工程师

教育经历：
北京大学 计算机科学与技术 本科 2015.09 - 2019.06
主修课程：数据结构、算法、操作系统、计算机网络、数据库原理
获得荣誉：校级一等奖学金（2017、2018）、优秀毕业生

专业技能：
- 编程语言：Python（精通）、Java（熟练）、Go（掌握）、JavaScript（熟练）
- 框架技术：Django、Flask、Spring Boot、Vue.js、React
- 数据库：MySQL、PostgreSQL、MongoDB、Redis
- 开发工具：Git、Docker、Kubernetes、Jenkins、Linux

实习经历：
阿里巴巴（杭州） - 后端开发实习生 2018.07 - 2018.10
- 参与淘宝交易系统的核心模块开发，使用Java和Spring Boot框架
- 负责订单处理流程的优化，通过异步处理将响应时间从500ms降低到100ms
- 使用MySQL优化数据库查询，提升系统吞吐量30%
- 参与代码审查，发现并修复多个潜在的性能问题

腾讯（深圳） - 后端开发实习生 2019.01 - 2019.04
- 参与微信支付系统的接口开发，使用Python和Django框架
- 设计并实现了支付路由系统，支持多种支付方式的统一接入
- 使用Redis缓存热点数据，将支付成功率从99.5%提升到99.9%
- 编写单元测试，代码覆盖率达到85%

项目经历：
分布式任务调度系统（个人项目） 2019.05 - 2019.08
- 使用Go语言开发了一个分布式的任务调度系统
- 支持定时任务、延时任务和依赖任务
- 使用etcd作为服务发现和配置中心
- 系统支持水平扩展，可处理10万+任务/天
- 开源在GitHub，获得500+ stars

在线教育平台（团队项目） 2018.10 - 2018.12
- 使用Vue.js和Spring Boot开发的前后端分离项目
- 实现了在线直播、录播、作业管理等功能
- 使用WebRTC实现音视频直播，延迟<500ms
- 项目获得校级创新大赛一等奖

开源经历：
贡献 Apache Dubbo 项目 2019.06 - 至今
- 修复了多个性能相关的bug
- 优化了服务发现机制的实现
- 提交了20+个PR，合并15个
- 成为社区的活跃贡献者

开发 Python 工具库 pyutils 2019.03 - 至今
- 开发了一系列Python开发中常用的工具函数
- 包括日志处理、配置管理、HTTP客户端等模块
- 在PyPI上发布，月下载量1000+
- 获得了良好的社区反馈

荣誉奖项：
- ACM/ICPC亚洲区银奖（2018）
- 全国大学生数学建模竞赛一等奖（2017）
- 北京大学优秀毕业生（2019）
- 腾讯优秀实习生（2019）
- 阿里巴巴技术之星（2018）

自我评价：
热爱编程，有5年以上的开发经验
熟悉分布式系统设计和微服务架构
具备良好的沟通能力和团队协作精神
持续学习，关注技术发展趋势
"""


async def test_serial_processing(text: str, provider: str):
    """测试串行处理"""
    print("\n=== 测试串行处理 ===")
    schema_desc = """格式:{"name":"姓名","contact":{"phone":"电话","email":"邮箱"},"objective":"求职意向","education":[{"title":"学校","subtitle":"学历","date":"时间","major":"专业","details":["荣誉"]}],"internships":[{"title":"公司","subtitle":"职位","date":"时间","highlights":["工作内容"]}],"projects":[{"title":"项目名","subtitle":"角色","date":"时间","highlights":["描述"]}],"openSource":[{"title":"开源项目","subtitle":"描述","items":["贡献"],"repoUrl":"链接"}],"skills":[{"category":"类别","details":"技能"}],"awards":["奖项"]}"""

    chunks = split_resume_text(text, max_chunk_size=300)
    print(f"分块数: {len(chunks)}")

    start_time = time.time()
    chunks_results = []

    for i, chunk in enumerate(chunks):
        print(f"处理第 {i+1}/{len(chunks)} 块...")
        chunk_start = time.time()

        chunk_prompt = f"""从简历文本片段提取信息,只输出JSON(不要markdown,无数据的字段用空数组[]):
片段内容({chunk['section']}):
{chunk['content']}
{schema_desc}"""

        raw = call_llm(provider, chunk_prompt)

        # 简单解析（避免导入复杂的工具）
        import json
        try:
            cleaned = raw.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:-3]
            elif cleaned.startswith('```'):
                cleaned = cleaned[3:-3]
            chunk_data = json.loads(cleaned)
        except:
            chunk_data = {}

        chunks_results.append(chunk_data)
        chunk_time = time.time() - chunk_start
        print(f"  完成，耗时: {chunk_time:.2f}秒")

    total_time = time.time() - start_time
    merged = merge_resume_chunks(chunks_results)

    print(f"\n串行处理总耗时: {total_time:.2f}秒")
    print(f"平均每块: {total_time/len(chunks):.2f}秒")

    return total_time, merged


async def test_parallel_processing(text: str, provider: str, max_concurrent: int = 3):
    """测试并行处理"""
    print(f"\n=== 测试并行处理（并发数: {max_concurrent}）===")

    processor = ParallelChunkProcessor(max_concurrent=max_concurrent)

    schema_desc = """格式:{"name":"姓名","contact":{"phone":"电话","email":"邮箱"},"objective":"求职意向","education":[{"title":"学校","subtitle":"学历","date":"时间","major":"专业","details":["荣誉"]}],"internships":[{"title":"公司","subtitle":"职位","date":"时间","highlights":["工作内容"]}],"projects":[{"title":"项目名","subtitle":"角色","date":"时间","highlights":["描述"]}],"openSource":[{"title":"开源项目","subtitle":"描述","items":["贡献"],"repoUrl":"链接"}],"skills":[{"category":"类别","details":"技能"}],"awards":["奖项"]}"""

    chunks = split_resume_text(text, max_chunk_size=300)
    print(f"分块数: {len(chunks)}")

    start_time = time.time()
    chunk_results = await processor.process_chunks_parallel(provider, chunks, schema_desc)
    merged = merge_resume_chunks(chunk_results)
    total_time = time.time() - start_time

    processor.close()

    print(f"\n并行处理总耗时: {total_time:.2f}秒")

    return total_time, merged


async def main():
    """主测试函数"""
    print(f"测试文本长度: {len(TEST_RESUME)} 字符")

    provider = DEFAULT_AI_PROVIDER
    print(f"使用AI提供商: {provider}")

    # 测试多次取平均值
    serial_times = []
    parallel_times = []

    for i in range(3):
        print(f"\n第 {i+1} 轮测试:")

        # 串行处理
        serial_time, _ = await test_serial_processing(TEST_RESUME, provider)
        serial_times.append(serial_time)

        # 等待一下避免API限流
        await asyncio.sleep(2)

        # 并行处理
        parallel_time, _ = await test_parallel_processing(TEST_RESUME, provider, max_concurrent=3)
        parallel_times.append(parallel_time)

        # 等待一下避免API限流
        await asyncio.sleep(2)

    # 计算平均值
    avg_serial = sum(serial_times) / len(serial_times)
    avg_parallel = sum(parallel_times) / len(parallel_times)
    improvement = (avg_serial - avg_parallel) / avg_serial * 100

    print("\n" + "="*50)
    print("性能对比结果:")
    print(f"串行处理平均耗时: {avg_serial:.2f}秒")
    print(f"并行处理平均耗时: {avg_parallel:.2f}秒")
    print(f"性能提升: {improvement:.1f}%")
    print(f"速度倍数: {avg_serial/avg_parallel:.2f}x")
    print("="*50)


if __name__ == "__main__":
    asyncio.run(main())