#!/usr/bin/env python3
"""
测试空数组修复 - 专门测试 workExperience 为空或不存在的情况
"""
import json
import requests
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.json_path import parse_path, get_by_path, set_by_path
from backend.agents.tools.cv_editor import create_cv_editor

API_BASE = "http://localhost:8000"

def test_direct_cv_editor():
    """直接测试 CVEditor 工具"""
    print("=" * 60)
    print("直接测试 CVEditor 工具")
    print("=" * 60)
    
    # 测试用例1: workExperience 不存在
    resume1 = {
        "basic": {"name": "张三"}
    }
    
    # 测试用例2: workExperience 为空数组
    resume2 = {
        "basic": {"name": "张三"},
        "workExperience": []
    }
    
    test_cases = [
        ("workExperience 不存在", resume1),
        ("workExperience 为空数组", resume2)
    ]
    
    for desc, resume in test_cases:
        print(f"\n{desc}:")
        print(f"  初始数据: {json.dumps(resume, ensure_ascii=False, indent=2)}")
        
        editor = create_cv_editor(resume)
        
        # 测试更新 workExperience[0].description
        result = editor._run(
            path="workExperience[0].description",
            action="update",
            value="负责域名注册相关工作"
        )
        
        print(f"  操作结果: {result.get('success', False)}")
        print(f"  消息: {result.get('message', 'N/A')}")
        
        if result.get('success'):
            print(f"  ✅ 操作成功")
            print(f"  更新后数据: {json.dumps(resume, ensure_ascii=False, indent=2)}")
        else:
            print(f"  ❌ 操作失败: {result.get('message', 'N/A')}")

def test_api_empty_array():
    """测试 API 调用 - 空数组情况"""
    print("\n" + "=" * 60)
    print("测试 API 调用 - 空数组情况")
    print("=" * 60)
    
    # 测试用例1: workExperience 不存在
    resume1 = {
        "basic": {"name": "张三", "title": "前端工程师"}
    }
    
    # 测试用例2: workExperience 为空数组
    resume2 = {
        "basic": {"name": "张三", "title": "前端工程师"},
        "workExperience": []
    }
    
    test_cases = [
        ("workExperience 不存在", resume1),
        ("workExperience 为空数组", resume2)
    ]
    
    for desc, resume in test_cases:
        print(f"\n{desc}:")
        print(f"  初始数据: {json.dumps(resume, ensure_ascii=False, indent=2)}")
        
        message = "我在腾讯负责的是域名注册"
        print(f"  用户输入: {message}")
        
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
                print(f"  API 响应:")
                print(f"    成功: {result.get('success', False)}")
                print(f"    回复: {result.get('reply', 'N/A')[:150]}")
                
                if result.get('tool_call'):
                    tool_call = result['tool_call']
                    params = tool_call.get('params', {})
                    print(f"    工具: {tool_call.get('name')}")
                    print(f"    路径: {params.get('path', 'N/A')}")
                    print(f"    操作: {params.get('action', 'N/A')}")
                
                if result.get('success'):
                    print(f"  ✅ 操作成功")
                else:
                    print(f"  ❌ 操作失败")
            else:
                print(f"  ❌ API 调用失败: HTTP {response.status_code}")
                print(f"  响应: {response.text[:200]}")
                
        except Exception as e:
            print(f"  ❌ 请求异常: {e}")

def test_multi_round_comprehensive():
    """多轮综合测试"""
    print("\n" + "=" * 60)
    print("多轮综合测试")
    print("=" * 60)
    
    resume_data = {
        "basic": {"name": "张三", "title": "前端工程师"},
        "workExperience": []
    }
    
    messages = [
        ("查看工作经历", "查看我的工作经历"),
        ("添加工作经历", "添加一段工作经历，公司是腾讯，职位是前端工程师，时间是2024-01到现在"),
        ("更新描述（空数组）", "我在腾讯负责的是域名注册"),
        ("更新描述（有数据）", "更新工作描述为：负责域名注册系统的前端开发"),
        ("添加第二段工作经历", "添加一段工作经历，公司是阿里巴巴，职位是高级前端工程师，时间是2022-01到2023-12"),
        ("更新第二段描述", "我在阿里巴巴负责的是电商平台开发"),
        ("查看完整简历", "查看我的完整简历")
    ]
    
    for i, (desc, message) in enumerate(messages, 1):
        print(f"\n第 {i} 轮 - {desc}:")
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
                    params = tool_call.get('params', {})
                    path = params.get('path', '')
                    action = params.get('action', '')
                    
                    print(f"  工具: {tool_call.get('name')} - {action}")
                    print(f"  路径: {path}")
                    
                    # 模拟更新简历数据
                    if tool_call.get('name') == 'CVEditor':
                        if action == 'update':
                            if path == 'workExperience[0].description':
                                if resume_data.get('workExperience') and len(resume_data['workExperience']) > 0:
                                    resume_data['workExperience'][0]['description'] = params.get('value')
                                    print(f"  ✅ 简历数据已更新")
                                else:
                                    print(f"  ⚠️ 无法更新：workExperience[0] 不存在")
                            elif path == 'workExperience[1].description':
                                if resume_data.get('workExperience') and len(resume_data['workExperience']) > 1:
                                    resume_data['workExperience'][1]['description'] = params.get('value')
                                    print(f"  ✅ 简历数据已更新")
                                else:
                                    print(f"  ⚠️ 无法更新：workExperience[1] 不存在")
                        elif action == 'add':
                            if path == 'workExperience':
                                resume_data.setdefault('workExperience', []).append(params.get('value'))
                                print(f"  ✅ 简历数据已更新")
                
                print(f"  回复: {result.get('reply', 'N/A')[:100]}")
                
            else:
                print(f"  ❌ API 调用失败: HTTP {response.status_code}")
                
        except Exception as e:
            print(f"  ❌ 请求异常: {e}")
    
    print(f"\n最终简历数据:")
    print(json.dumps(resume_data, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    test_direct_cv_editor()
    test_api_empty_array()
    test_multi_round_comprehensive()
    
    print("\n" + "=" * 60)
    print("✅ 所有测试完成")
    print("=" * 60)

