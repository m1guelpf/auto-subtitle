from setuptools import setup, find_packages

setup(
    version="1.0",
    name="visub",
    packages=find_packages(),
    py_modules=["visub"],
    author="Lorenzo Herrán (forked from Miguel Piedrafita)",
    install_requires=[
        'whisperx',
        'ffmpeg',
        'ffmpeg-python'
    ],
    description="Automatically generate and embed subtitles into your videos",
    entry_points={
        'console_scripts': ['visub=visub.cli:main'],
    },
    include_package_data=True,
)
