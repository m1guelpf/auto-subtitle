from setuptools import setup, find_packages

setup(
    version="1.0",
    name="auto_subtitle",
    packages=find_packages(),
    py_modules=["auto_subtitle"],
    author="Miguel Piedrafita, Bohui WU",
    install_requires=[
        'openai-whisper',
        'psutil'
    ],
    description="Automatically generate and/or embed subtitles into your videos",
    entry_points={
        'console_scripts': ['subtitle=auto_subtitle.cli:main'],
    },
    include_package_data=True,
)
