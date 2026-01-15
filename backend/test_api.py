#!/usr/bin/env python3
"""
测试 API 端点
"""
import requests
import json

BASE_URL = "http://localhost:9000"

def test_health():
    """测试健康检查"""
    print("1. 测试健康检查...")
    try:
        r = requests.get(f"{BASE_URL}/api/health")
        print(f"   ✅ 健康检查: {r.status_code} - {r.json()}")
        return True
    except Exception as e:
        print(f"   ❌ 健康检查失败: {e}")
        return False

def test_register():
    print("\n2. 测试用户注册...")
    try:
        data = {
            "email": "test@example.com",
            "password": "test123456"
        }
        r = requests.post(f"{BASE_URL}/api/auth/register", json=data)
        if r.status_code == 200:
            result = r.json()
            print(f"   ✅ 注册成功: {result.get('user', {}).get('email')}")
            return result.get('access_token')
        else:
            print(f"   ❌ 注册失败: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"   ❌ 注册失败: {e}")
        return None

def test_login():
    print("\n3. 测试用户登录...")
    try:
        data = {
            "email": "test@example.com",
            "password": "test123456"
        }
        r = requests.post(f"{BASE_URL}/api/auth/login", json=data)
        if r.status_code == 200:
            result = r.json()
            print(f"   ✅ 登录成功: {result.get('user', {}).get('email')}")
            return result.get('access_token')
        else:
            print(f"   ❌ 登录失败: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"   ❌ 登录失败: {e}")
        return None

def test_get_me(token):
    print("\n4. 测试获取用户信息...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        if r.status_code == 200:
            result = r.json()
            print(f"   ✅ 获取用户信息成功: {result.get('email')}")
            return result
        else:
            print(f"   ❌ 获取用户信息失败: {r.status_code} - {r.text}")
            return None
    except Exception as e:
        print(f"   ❌ 获取用户信息失败: {e}")
        return None

def test_list_resumes(token):
    print("\n5. 测试获取简历列表...")
    try:
        headers = {"Authorization": f"Bearer {token}"}
        r = requests.get(f"{BASE_URL}/api/resumes", headers=headers)
        if r.status_code == 200:
            resumes = r.json()
            print(f"   ✅ 获取简历列表成功: {len(resumes)} 份简历")
            return True
        else:
            print(f"   ❌ 获取简历列表失败: {r.status_code} - {r.text}")
            return False
    except Exception as e:
        print(f"   ❌ 获取简历列表失败: {e}")
        return False

if __name__ == "__main__":
    print("=" * 50)
    print("API 测试脚本")
    print("=" * 50)
    
    if not test_health():
        print("\n❌ 后端服务未启动，请先启动后端服务")
        exit(1)
    
    token = test_register()
    if not token:
        token = test_login()
    
    if token:
        test_get_me(token)
        test_list_resumes(token)
    
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)
