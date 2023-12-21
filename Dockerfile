# Use an official Python runtime as a parent image
FROM python:3.8-slim

# Set the working directory in the container
WORKDIR /usr/src/app

# Install ffmpeg and git
RUN apt-get update && apt-get install -y ffmpeg git

# Install ffmpeg-python library
RUN pip install ffmpeg-python

# Clone the repository and install its dependencies
RUN pip install git+https://github.com/m1guelpf/auto-subtitle.git

# Copy the local code to the container
COPY . .

# Define environment variable
ENV NAME AutoSubtitle

# Set the default command for the container
CMD ["auto_subtitle"]
