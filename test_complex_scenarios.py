#!/usr/bin/env python3
"""
复杂场景测试脚本
测试难度较大的工作经历添加场景，包括：
1. 用户提供完整的工作经历描述，需要解析并插入
2. 用户提供部分信息，需要引导补充
3. 用户提供多段经历，需要批量处理
4. 用户提供格式不规范的信息，需要智能解析
"""
import json
import requests
import time
from typing import Dict, Any, List

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
    "workExperience": [],
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

def print_test_result(test_num: int, scenario: str, message: str, result: Dict[str, Any], issues: List[str]):
    """打印测试结果并记录问题"""
    print(f"\n{'='*80}")
    print(f"测试 {test_num}: {scenario}")
    print(f"{'='*80}")
    print(f"用户输入: {message}")
    print(f"\n响应:")
    print(f"  成功: {result.get('success', False)}")
    print(f"  回复: {result.get('reply', 'N/A')[:300]}")
    
    if result.get('tool_call'):
        tool_call = result['tool_call']
        print(f"\n工具调用:")
        print(f"  名称: {tool_call.get('name', 'N/A')}")
        params = tool_call.get('params', {})
        print(f"  路径: {params.get('path', 'N/A')}")
        print(f"  操作: {params.get('action', 'N/A')}")
        if params.get('value'):
            value = params.get('value')
            if isinstance(value, dict):
                print(f"  值: {json.dumps(value, ensure_ascii=False, indent=4)[:200]}...")
            else:
                print(f"  值: {str(value)[:100]}")
    
    if result.get('error'):
        print(f"\n❌ 错误: {result['error']}")
        issues.append(f"测试 {test_num}: {scenario} - API错误: {result['error']}")
    
    # 检查工具调用是否正确
    if result.get('success') and result.get('tool_call'):
        tool_call = result['tool_call']
        params = tool_call.get('params', {})
        action = params.get('action')
        path = params.get('path')
        value = params.get('value')
        
        # 检查问题
        if action == 'add' and path == 'workExperience':
            if not isinstance(value, dict):
                issues.append(f"测试 {test_num}: {scenario} - add操作的值应该是字典，但收到: {type(value)}")
            else:
                # 检查必要字段
                required_fields = ['company', 'position', 'startDate', 'endDate']
                missing_fields = [f for f in required_fields if f not in value]
                if missing_fields:
                    issues.append(f"测试 {test_num}: {scenario} - 缺少必要字段: {missing_fields}")
                
                # 检查字段值是否为空
                empty_fields = [f for f in value if not value.get(f)]
                if empty_fields:
                    issues.append(f"测试 {test_num}: {scenario} - 字段值为空: {empty_fields}")
        
        # 检查路径是否正确
        if 'workExperience' in message and 'workExperience' not in path:
            issues.append(f"测试 {test_num}: {scenario} - 路径可能不正确，期望包含workExperience，实际: {path}")
    
    # 检查回复质量
    reply = result.get('reply', '')
    if result.get('success') and not reply:
        issues.append(f"测试 {test_num}: {scenario} - 成功但无回复内容")
    
    if '错误' in reply or '失败' in reply or '❌' in reply:
        if result.get('success'):
            issues.append(f"测试 {test_num}: {scenario} - 回复中包含错误信息但状态为成功")

def main():
    """主测试流程"""
    print("🚀 开始复杂场景测试")
    print(f"API 地址: {API_BASE}/api/agent/cv-tools")
    
    # 复制初始数据
    resume_data = json.loads(json.dumps(INITIAL_RESUME))
    
    # 记录所有问题
    all_issues = []
    
    # 测试用例 - 复杂场景
    test_cases = [
        # 场景1: 用户提供完整的工作经历描述（自然语言）
        {
            "scenario": "完整工作经历描述（自然语言）",
            "message": "我要增加一段工作经历：我在腾讯工作，职位是前端开发工程师，时间是2022年7月到2024年6月，主要负责域名注册系统的前端开发，使用React和TypeScript，提升了系统性能30%，用户满意度提升了25%",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate", "description"]
            }
        },
        
        # 场景2: 用户提供部分信息，需要补充
        {
            "scenario": "部分信息的工作经历",
            "message": "添加一段在阿里巴巴的工作经历，职位是高级前端工程师，时间是2020年到2022年",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate"]
            }
        },
        
        # 场景3: 用户提供格式不规范的信息
        {
            "scenario": "格式不规范的信息",
            "message": "我在字节跳动做过前端，2021.3-2023.5，负责抖音前端开发，用了vue，性能优化了很多",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate"]
            }
        },
        
        # 场景4: 用户提供多段经历（一次性）
        {
            "scenario": "多段经历（一次性描述）",
            "message": "我还在美团工作过，职位是前端工程师，时间是2019年6月到2020年12月，主要负责外卖平台的开发。另外在滴滴也工作过，职位是高级前端工程师，时间是2018年1月到2019年5月",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "note": "可能需要多次工具调用或LLM识别为多个操作"
            }
        },
        
        # 场景5: 用户提供详细描述但缺少关键信息
        {
            "scenario": "详细描述但缺少关键信息",
            "message": "添加一段工作经历：我负责开发了一个电商平台，使用了React、Node.js，实现了用户登录、商品展示、购物车等功能，系统日活用户达到10万，订单处理速度提升了50%",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate"],
                "note": "缺少公司名称、职位、时间等关键信息，系统应该引导或推断"
            }
        },
        
        # 场景6: 用户提供英文描述
        {
            "scenario": "英文描述的工作经历",
            "message": "Add a work experience: I worked at Google as a Frontend Engineer from 2020-01 to 2022-12, responsible for developing web applications using React and TypeScript",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate"]
            }
        },
        
        # 场景7: 用户提供带项目成果的详细描述
        {
            "scenario": "带项目成果的详细描述",
            "message": "我在京东工作过，职位是前端架构师，时间是2021年3月到2023年8月。我负责设计和开发了京东商城的核心前端架构，使用微前端架构，将系统拆分为多个独立模块，提升了开发效率40%，减少了代码耦合度，团队协作更加顺畅。我还优化了页面加载速度，首屏渲染时间从3秒降低到1.2秒，用户体验显著提升",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate", "description"],
                "note": "描述应该包含详细的成果和量化数据"
            }
        },
        
        # 场景8: 用户提供实习经历（需要区分）
        {
            "scenario": "实习经历（需要区分工作经历和实习经历）",
            "message": "添加一段实习经历：我在腾讯实习，职位是前端开发实习生，时间是2023年7月到2023年10月，主要负责小程序开发",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "note": "系统需要判断是添加到workExperience还是单独的实习经历模块"
            }
        },
        
        # 场景9: 用户提供时间格式不统一的信息
        {
            "scenario": "时间格式不统一",
            "message": "添加工作经历：公司是拼多多，职位是前端工程师，开始时间是2020/07/01，结束时间是2022/06/30",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate"],
                "note": "时间格式需要统一转换为标准格式（如YYYY-MM）"
            }
        },
        
        # 场景10: 用户提供模糊的时间信息
        {
            "scenario": "模糊的时间信息",
            "message": "我在小米工作过，职位是前端开发，大概是2021年初到2022年底，主要负责MIUI系统的前端开发",
            "expected": {
                "action": "add",
                "path": "workExperience",
                "should_have": ["company", "position", "startDate", "endDate"],
                "note": "系统需要处理模糊时间，可能需要询问或推断"
            }
        },
    ]
    
    # 执行测试
    for i, test_case in enumerate(test_cases, 1):
        scenario = test_case["scenario"]
        message = test_case["message"]
        
        # 调用 API
        result = test_api(message, resume_data)
        
        # 打印结果并记录问题
        print_test_result(i, scenario, message, result, all_issues)
        
        # 如果工具调用成功，更新本地简历数据（简化版）
        if result.get('success') and result.get('tool_call'):
            tool_call = result['tool_call']
            tool_name = tool_call.get('name')
            params = tool_call.get('params', {})
            
            if tool_name == 'CVEditor' and params.get('action') == 'add':
                path = params.get('path', '')
                value = params.get('value')
                
                if path == 'workExperience' and isinstance(value, dict):
                    resume_data.setdefault('workExperience', []).append(value)
                    print(f"  ✅ 简历数据已更新，当前工作经历数量: {len(resume_data.get('workExperience', []))}")
        
        # 等待一下，避免请求过快
        time.sleep(1)
    
    # 打印总结
    print(f"\n{'='*80}")
    print("测试总结")
    print(f"{'='*80}")
    print(f"总测试数: {len(test_cases)}")
    print(f"发现问题数: {len(all_issues)}")
    
    if all_issues:
        print(f"\n发现的问题:")
        for issue in all_issues:
            print(f"  - {issue}")
    else:
        print("\n✅ 未发现问题")
    
    # 打印最终简历数据
    print(f"\n最终简历数据:")
    print(f"  工作经历数量: {len(resume_data.get('workExperience', []))}")
    if resume_data.get('workExperience'):
        for i, exp in enumerate(resume_data['workExperience'], 1):
            print(f"\n  工作经历 {i}:")
            print(f"    公司: {exp.get('company', 'N/A')}")
            print(f"    职位: {exp.get('position', 'N/A')}")
            print(f"    时间: {exp.get('startDate', 'N/A')} - {exp.get('endDate', 'N/A')}")
            desc = exp.get('description', '')
            if desc:
                print(f"    描述: {desc[:100]}...")
    
    return all_issues

if __name__ == "__main__":
    issues = main()
    
    # 将问题保存到文件
    with open('/Users/wy770/AI 简历/test_issues.json', 'w', encoding='utf-8') as f:
        json.dump(issues, f, ensure_ascii=False, indent=2)
    
    print(f"\n问题已保存到 test_issues.json")

