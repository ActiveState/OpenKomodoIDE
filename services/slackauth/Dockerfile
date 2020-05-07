FROM python:3.7.6

WORKDIR /usr/src/app

COPY . ./

RUN pip install -r requirements.txt

EXPOSE 8080

CMD ["python", "manage.py", "runserver", "0.0.0.0:8080"]

# tail -f /proc/1/fd/1 | sed 's/^/1: /' & tail -f /proc/1/fd/2 | sed 's/^/2: /'
