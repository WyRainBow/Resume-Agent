#!/usr/bin/env python3
"""
Railway 后端监控脚本
每隔指定时间检查后端健康状态和部署日志
"""
import requests
import time
import sys
from datetime import datetime

# 配置
BACKEND_URL = "https://resume-agent-production-5306.up.railway.app"
CHECK_INTERVAL = 30  # 检查间隔（秒）

def check_health():
    """检查后端健康状态"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=10)
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, str(e)

def check_api_keys():
    """检查 API Key 配置状态"""
    try:
        response = requests.get(f"{BACKEND_URL}/api/config/keys", timeout=10)
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"HTTP {response.status_code}"
    except requests.exceptions.RequestException as e:
        return False, str(e)

def print_status(healthy, message, api_keys=None):
    """打印状态信息"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    status_icon = "✅" if healthy else "❌"
    
    print(f"\n{'='*60}")
    print(f"[{timestamp}] 后端状态: {status_icon}")
    print(f"{'='*60}")
    
    if healthy:
        print(f"  健康检查: {message}")
        if api_keys:
            print(f"  智谱 AI: {'已配置 (' + api_keys['zhipu']['preview'] + ')' if api_keys['zhipu']['configured'] else '未配置'}")
            print(f"  豆包 AI: {'已配置 (' + api_keys['doubao']['preview'] + ')' if api_keys['doubao']['configured'] else '未配置'}")
    else:
        print(f"  错误: {message}")
        print(f"  提示: 检查 Railway Deploy Logs 查看详细错误")

def monitor_once():
    """执行一次检查"""
    healthy, health_result = check_health()
    api_keys = None
    
    if healthy:
        _, api_keys = check_api_keys()
    
    print_status(healthy, health_result, api_keys)
    return healthy

def monitor_loop():
    """持续监控"""
    print(f"🔍 开始监控后端: {BACKEND_URL}")
    print(f"📌 检查间隔: {CHECK_INTERVAL} 秒")
    print(f"📌 按 Ctrl+C 停止监控")
    
    try:
        while True:
            monitor_once()
            time.sleep(CHECK_INTERVAL)
    except KeyboardInterrupt:
        print("\n\n👋 监控已停止")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--once":
        # 只检查一次
        monitor_once()
    else:
        # 持续监控
        monitor_loop()

