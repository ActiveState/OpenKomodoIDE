from setuptools import setup

install_requires = [
    'Flask==0.6.1',
    'Flask-Script==0.3.1',
    'redis>=2.0.0',
]

setup(name='KomobServer',
      version='0.1',
      description='Komodo Collaboration Server',
      packages=['komob', 'mobwrite'],
      package_dir={'': 'src'},
      install_requires=install_requires,
      )
