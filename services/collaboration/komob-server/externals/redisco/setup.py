#!/usr/bin/env python
import os

version = '0.1.2'

try:
    from setuptools import setup
except ImportError:
    from distutils.core import setup

def read(fname):
    return open(os.path.join(os.path.dirname(__file__), fname)).read()

setup(name='redisco',
      version=version,
      description='Python Containers and Simple Models for Redis',
      url='http://github.com/iamteem/redisco',
      download_url='',
      long_description=read('README.rst'),
      author='Tim Medina',
      author_email='iamteem@gmail.com',
      maintainer='Tim Medina',
      maintainer_email='iamteem@gmail.com',
      keywords=['Redis', 'model', 'container'],
      license='MIT',
      packages=['redisco', 'redisco.models'],
      test_suite='tests.all_tests',
      classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Console',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python'],
    )

