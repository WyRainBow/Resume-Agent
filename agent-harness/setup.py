from setuptools import find_namespace_packages, setup

setup(
    name="cli-anything-resume-agent",
    version="0.1.0",
    description="CLI harness for Resume-Agent",
    packages=find_namespace_packages(include=["cli_anything.*"]),
    include_package_data=True,
    install_requires=["click>=8.1.0"],
    entry_points={
        "console_scripts": [
            "cli-anything-resume-agent=cli_anything.resume_agent.resume_agent_cli:main"
        ]
    },
)
