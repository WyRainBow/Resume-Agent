#!/usr/bin/env python3
"""
多轮对话 Agent 测试脚本
测试 /api/agent/cv-tools 接口的各种场景
"""
import json
import requests
import time
from typing import Dict, Any

API_BASE = "http://localhost:8000"

# 初始简历数据
INITIAL_RESUME = {
    "basic": {
        "name": "张三",
        "title": "前端工程师",
        "email": "zhangsan@example.com",
        "phone": "13800138000",
        "location": "北京"
    },
    "education": [
        {
            "school": "清华大学",
            "major": "计算机科学",
            "degree": "本科",
            "startDate": "2018-09",
            "endDate": "2022-06",
            "description": "主修课程：数据结构、算法、操作系统"
        }
    ],
    "workExperience": [
        {
            "company": "阿里巴巴",
            "position": "前端工程师",
            "startDate": "2022-07",
            "endDate": "2024-06",
            "description": "负责前端开发工作"
        }
    ],
    "projects": [],
    "skillContent": "JavaScript, React, Vue"
}

def test_api(message: str, resume_data: Dict[str, Any]) -> Dict[str, Any]:
    """测试 API 调用"""
    url = f"{API_BASE}/api/agent/cv-tools"
    
    try:
        response = requests.post(
            url,
            json={
                "message": message,
                "resume_data": resume_data
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        return {"error": str(e), "success": False}

def print_result(round_num: int, message: str, result: Dict[str, Any], resume_data: Dict[str, Any]):
    """打印测试结果"""
    print(f"\n{'='*60}")
    print(f"第 {round_num} 轮测试")
    print(f"{'='*60}")
    print(f"用户输入: {message}")
    print(f"\n响应:")
    print(f"  成功: {result.get('success', False)}")
    print(f"  回复: {result.get('reply', 'N/A')[:200]}")
    
    if result.get('tool_call'):
        tool_call = result['tool_call']
        print(f"\n工具调用:")
        print(f"  名称: {tool_call.get('name', 'N/A')}")
        print(f"  参数: {json.dumps(tool_call.get('params', {}), ensure_ascii=False, indent=4)}")
    
    # 显示简历数据变化
    if result.get('tool_call', {}).get('name') == 'CVEditor':
        print(f"\n简历数据已更新:")
        if 'basic' in resume_data and 'name' in resume_data['basic']:
            print(f"  姓名: {resume_data['basic']['name']}")
        if 'education' in resume_data:
            print(f"  教育经历数量: {len(resume_data['education'])}")
        if 'workExperience' in resume_data:
            print(f"  工作经历数量: {len(resume_data['workExperience'])}")
    
    if result.get('error'):
        print(f"\n❌ 错误: {result['error']}")

def main():
    """主测试流程"""
    print("🚀 开始多轮对话 Agent 测试")
    print(f"API 地址: {API_BASE}/api/agent/cv-tools")
    
    # 复制初始数据
    resume_data = json.loads(json.dumps(INITIAL_RESUME))
    
    # 测试用例
    test_cases = [
        # 第1轮：查看名字
        {
            "message": "查看我的名字",
            "expected_tool": "CVReader",
            "description": "读取基本信息"
        },
        # 第2轮：修改名字
        {
            "message": "把名字改成韦宇",
            "expected_tool": "CVEditor",
            "description": "修改姓名"
        },
        # 第3轮：验证名字已修改
        {
            "message": "我的名字是什么",
            "expected_tool": "CVReader",
            "description": "验证修改结果"
        },
        # 第4轮：查看教育经历
        {
            "message": "查看我的教育经历",
            "expected_tool": "CVReader",
            "description": "读取教育经历"
        },
        # 第5轮：修改学校
        {
            "message": "把学校改成北京大学",
            "expected_tool": "CVEditor",
            "description": "修改教育经历中的学校"
        },
        # 第6轮：添加教育经历
        {
            "message": "添加一段教育经历，学校是复旦大学，专业是软件工程，学位是硕士，时间是2022-09到2024-06",
            "expected_tool": "CVEditor",
            "description": "添加新的教育经历"
        },
        # 第7轮：查看所有教育经历
        {
            "message": "我有几段教育经历",
            "expected_tool": "CVReader",
            "description": "统计教育经历数量"
        },
        # 第8轮：删除第一条教育经历
        {
            "message": "删除第一条教育经历",
            "expected_tool": "CVEditor",
            "description": "删除数组元素"
        },
        # 第9轮：查看工作经历
        {
            "message": "查看我的工作经历",
            "expected_tool": "CVReader",
            "description": "读取工作经历"
        },
        # 第10轮：修改职位
        {
            "message": "把职位改成高级前端工程师",
            "expected_tool": "CVEditor",
            "description": "修改工作经历中的职位"
        },
        # 第11轮：添加工作经历
        {
            "message": "添加一段工作经历，公司是腾讯，职位是前端开发工程师，时间是2024-07到现在",
            "expected_tool": "CVEditor",
            "description": "添加新的工作经历"
        },
        # 第12轮：查看完整简历
        {
            "message": "查看我的完整简历",
            "expected_tool": "CVReader",
            "description": "读取完整简历数据"
        },
    ]
    
    # 执行测试
    for i, test_case in enumerate(test_cases, 1):
        message = test_case["message"]
        
        # 调用 API
        result = test_api(message, resume_data)
        
        # 打印结果
        print_result(i, message, result, resume_data)
        
        # 如果工具调用成功，更新本地简历数据（模拟前端更新）
        if result.get('success') and result.get('tool_call'):
            tool_call = result['tool_call']
            tool_name = tool_call.get('name')
            params = tool_call.get('params', {})
            
            # 模拟工具执行（简化版）
            if tool_name == 'CVEditor':
                action = params.get('action')
                path = params.get('path', '')
                value = params.get('value')
                
                # 简单的路径更新逻辑（实际应该使用 json_path 工具）
                if action == 'update':
                    if path == 'basic.name':
                        resume_data['basic']['name'] = value
                    elif path == 'education[0].school':
                        if resume_data.get('education') and len(resume_data['education']) > 0:
                            resume_data['education'][0]['school'] = value
                    elif path == 'workExperience[0].position':
                        if resume_data.get('workExperience') and len(resume_data['workExperience']) > 0:
                            resume_data['workExperience'][0]['position'] = value
                elif action == 'add':
                    if path == 'education':
                        resume_data.setdefault('education', []).append(value)
                    elif path == 'workExperience':
                        resume_data.setdefault('workExperience', []).append(value)
                elif action == 'delete':
                    if path.startswith('education['):
                        idx = int(path.split('[')[1].split(']')[0])
                        if resume_data.get('education') and idx < len(resume_data['education']):
                            resume_data['education'].pop(idx)
        
        # 等待一下，避免请求过快
        time.sleep(0.5)
    
    print(f"\n{'='*60}")
    print("✅ 所有测试完成！")
    print(f"{'='*60}")
    
    # 打印最终简历数据
    print("\n最终简历数据:")
    print(json.dumps(resume_data, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

