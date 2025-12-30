#!/usr/bin/env python3
"""
测试 workExperience[0].description 的错误
复现和修复 "Cannot read properties of undefined (reading '0')" 问题
"""
import json
import requests
import sys
import os

# 添加路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.json_path import parse_path, get_by_path, set_by_path

API_BASE = "http://localhost:8000"

def test_path_parsing():
    """测试路径解析"""
    print("=" * 60)
    print("测试路径解析")
    print("=" * 60)
    
    test_paths = [
        "workExperience[0].description",
        "workExperience[0]",
        "workExperience",
        "basic.name",
        "education[0].school"
    ]
    
    for path in test_paths:
        parts = parse_path(path)
        print(f"路径: {path}")
        print(f"  解析结果: {parts}")
        print()

def test_get_by_path_empty_array():
    """测试访问空数组的情况"""
    print("=" * 60)
    print("测试访问空数组")
    print("=" * 60)
    
    # 情况1: workExperience 不存在
    resume1 = {
        "basic": {"name": "张三"}
    }
    
    # 情况2: workExperience 为空数组
    resume2 = {
        "basic": {"name": "张三"},
        "workExperience": []
    }
    
    # 情况3: workExperience 有数据
    resume3 = {
        "basic": {"name": "张三"},
        "workExperience": [
            {"company": "腾讯", "position": "前端工程师"}
        ]
    }
    
    test_cases = [
        ("workExperience 不存在", resume1),
        ("workExperience 为空数组", resume2),
        ("workExperience 有数据", resume3)
    ]
    
    for desc, resume in test_cases:
        print(f"\n{desc}:")
        print(f"  简历数据: {json.dumps(resume, ensure_ascii=False, indent=2)}")
        
        # 测试读取 workExperience
        try:
            _, _, value = get_by_path(resume, "workExperience")
            print(f"  ✅ workExperience: {value}")
        except Exception as e:
            print(f"  ❌ 读取 workExperience 失败: {e}")
        
        # 测试读取 workExperience[0]
        try:
            _, _, value = get_by_path(resume, "workExperience[0]")
            print(f"  ✅ workExperience[0]: {value}")
        except Exception as e:
            print(f"  ❌ 读取 workExperience[0] 失败: {e}")
        
        # 测试读取 workExperience[0].description
        try:
            _, _, value = get_by_path(resume, "workExperience[0].description")
            print(f"  ✅ workExperience[0].description: {value}")
        except Exception as e:
            print(f"  ❌ 读取 workExperience[0].description 失败: {e}")

def test_api_calls():
    """测试 API 调用"""
    print("\n" + "=" * 60)
    print("测试 API 调用")
    print("=" * 60)
    
    # 测试用例1: workExperience 为空
    resume1 = {
        "basic": {"name": "张三", "title": "前端工程师"},
        "workExperience": []
    }
    
    # 测试用例2: workExperience 不存在
    resume2 = {
        "basic": {"name": "张三", "title": "前端工程师"}
    }
    
    # 测试用例3: workExperience 有数据但没有 description
    resume3 = {
        "basic": {"name": "张三", "title": "前端工程师"},
        "workExperience": [
            {"company": "腾讯", "position": "前端工程师", "startDate": "2024-01"}
        ]
    }
    
    test_cases = [
        ("workExperience 为空", resume1, "我在腾讯负责的是域名注册"),
        ("workExperience 不存在", resume2, "我在腾讯负责的是域名注册"),
        ("workExperience 有数据", resume3, "我在腾讯负责的是域名注册"),
    ]
    
    for desc, resume, message in test_cases:
        print(f"\n{desc}:")
        print(f"  用户输入: {message}")
        print(f"  简历数据: {json.dumps(resume, ensure_ascii=False, indent=2)}")
        
        try:
            response = requests.post(
                f"{API_BASE}/api/agent/cv-tools",
                json={
                    "message": message,
                    "resume_data": resume
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"  ✅ API 调用成功")
                print(f"  成功: {result.get('success', False)}")
                print(f"  回复: {result.get('reply', 'N/A')[:100]}")
                
                if result.get('tool_call'):
                    tool_call = result['tool_call']
                    print(f"  工具调用: {tool_call.get('name')}")
                    print(f"  路径: {tool_call.get('params', {}).get('path', 'N/A')}")
                    
                    # 如果工具调用成功，检查简历数据是否更新
                    if result.get('success'):
                        print(f"  ✅ 操作成功")
                    else:
                        print(f"  ⚠️ 操作失败: {result.get('reply', 'N/A')}")
            else:
                print(f"  ❌ API 调用失败: HTTP {response.status_code}")
                print(f"  响应: {response.text[:200]}")
                
        except Exception as e:
            print(f"  ❌ 请求异常: {e}")

def test_multi_round():
    """多轮测试"""
    print("\n" + "=" * 60)
    print("多轮对话测试")
    print("=" * 60)
    
    resume_data = {
        "basic": {"name": "张三", "title": "前端工程师"},
        "workExperience": []
    }
    
    messages = [
        "查看我的工作经历",
        "添加一段工作经历，公司是腾讯，职位是前端工程师，时间是2024-01到现在",
        "我在腾讯负责的是域名注册",
        "更新工作描述为：负责域名注册系统的前端开发",
        "查看我的完整简历"
    ]
    
    for i, message in enumerate(messages, 1):
        print(f"\n第 {i} 轮:")
        print(f"  用户: {message}")
        
        try:
            response = requests.post(
                f"{API_BASE}/api/agent/cv-tools",
                json={
                    "message": message,
                    "resume_data": resume_data
                },
                timeout=10
            )
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('success') and result.get('tool_call'):
                    tool_call = result['tool_call']
                    tool_name = tool_call.get('name')
                    params = tool_call.get('params', {})
                    path = params.get('path', '')
                    action = params.get('action', '')
                    value = params.get('value')
                    
                    print(f"  工具: {tool_name}")
                    print(f"  路径: {path}")
                    if action:
                        print(f"  操作: {action}")
                    if value:
                        print(f"  值: {str(value)[:50]}")
                    
                    # 模拟更新简历数据（简化版）
                    if tool_name == 'CVEditor' and action == 'update':
                        if path == 'workExperience[0].description':
                            if resume_data.get('workExperience') and len(resume_data['workExperience']) > 0:
                                resume_data['workExperience'][0]['description'] = value
                                print(f"  ✅ 简历数据已更新")
                            else:
                                print(f"  ❌ 无法更新：workExperience[0] 不存在")
                    elif tool_name == 'CVEditor' and action == 'add':
                        if path == 'workExperience':
                            resume_data.setdefault('workExperience', []).append(value)
                            print(f"  ✅ 简历数据已更新")
                
                print(f"  回复: {result.get('reply', 'N/A')[:100]}")
                
            else:
                print(f"  ❌ API 调用失败: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ 请求异常: {e}")
    
    print(f"\n最终简历数据:")
    print(json.dumps(resume_data, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    # 运行所有测试
    test_path_parsing()
    test_get_by_path_empty_array()
    test_api_calls()
    test_multi_round()
    
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)

