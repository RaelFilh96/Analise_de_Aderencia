# setup.py
from setuptools import setup, find_packages

setup(
    name="mt5adherence",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "MetaTrader5",
        "pandas",
        "pyzmq",
    ],
)