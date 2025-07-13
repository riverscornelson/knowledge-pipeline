#!/usr/bin/env python
"""Setup script for knowledge-pipeline package."""

from setuptools import setup, find_packages

# Minimal setup.py for compatibility
# All configuration is in pyproject.toml
setup(
    packages=find_packages(where="src"),
    package_dir={"": "src"},
)