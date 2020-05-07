# Code originally from:
# https://github.com/c0state/BufferingSMTPHandler
#
# modified by ToddW to add timeout flush value.
#

import sys
import logging.handlers
import optparse
from threading import Timer

class BufferingSMTPHandler(logging.handlers.SMTPHandler):
    """
    BufferingSMTPHandler works like SMTPHandler log handler except that it
    buffers log messages until a certain criteria (capacity, timeout) is met, at
    which point it will then send everything that was buffered up until that
    point in one email message. The timeout value is in seconds. Contrast this
    with SMTPHandler which sends one email per log message received.
    """

    def __init__(self, mailhost, fromaddr, toaddrs, subject, credentials=None,
                 secure=None, capacity=1000, timeout=None):
        if sys.version_info < (2, 6):
            logging.handlers.SMTPHandler.__init__(self, mailhost, fromaddr,
                                                  toaddrs, subject)
        elif sys.version_info < (2, 7):
            # secure added in 2.6
            logging.handlers.SMTPHandler.__init__(self, mailhost, fromaddr,
                                                  toaddrs, subject,
                                                  credentials)
        else:
            # secure added in 2.7
            logging.handlers.SMTPHandler.__init__(self, mailhost, fromaddr,
                                                  toaddrs, subject,
                                                  credentials, secure)
        self.capacity = capacity
        self.buffer = []
        self.timeout = timeout
        self.timer = None

    def emit(self, record):
        try:
            if self.timeout and len(self.buffer) == 0:
                # Start a timer to flush the message after x seconds.
                self.timer = Timer(self.timeout, self.flush)
                self.timer.start()
            self.buffer.append(record)

            if len(self.buffer) >= self.capacity:
                if self.timer:
                    # Cancel the timer, it's no longer needed.
                    self.timer.cancel()
                self.flush()
        except (KeyboardInterrupt, SystemExit):
            raise
        except:
            self.handleError(record)

    def flush(self):
        # buffer on termination may be empty if capacity is an exact multiple of
        # lines that were logged--thus we need to check for empty buffer
        self.timer = None
        if not self.buffer:
            return

        try:
            import smtplib
            from email.utils import formatdate
            port = self.mailport
            if not port:
                port = smtplib.SMTP_PORT
            smtp = smtplib.SMTP(self.mailhost, port)
            msg = ""
            for record in self.buffer:
                msg = msg + self.format(record) + "\r\n"
            msg = "From: %s\r\nTo: %s\r\nSubject: %s\r\nDate: %s\r\n\r\n%s" % (
                            self.fromaddr,
                            ",".join(self.toaddrs),
                            self.getSubject(self.buffer[0]),
                            formatdate(), msg)
            if self.username:
                if self.secure is not None:
                    smtp.ehlo()
                    smtp.starttls(*self.secure)
                    smtp.ehlo()
                smtp.login(self.username, self.password)
            smtp.sendmail(self.fromaddr, self.toaddrs, msg)
            smtp.quit()
            self.buffer = []
        except (KeyboardInterrupt, SystemExit):
            raise
        except:
            self.handleError(self.buffer[0])

def parse_options():
    parser = optparse.OptionParser()
    parser.add_option("--smtp_server",
                      type = "string",
                      default = "mail.activestate.com",
                      help="SMTP to send logs via email")
    parser.add_option("--smtp_server_port",
                      type = "int",
                      help="SMTP server port")
    parser.add_option("--smtp_user",
                      type = "string",
                      help="User on SMTP server")
    parser.add_option("--smtp_passwd",
                      type = "string",
                      help="Password for user on SMTP server")
    parser.add_option("--email",
                      type = "string",
                      default="toddw@activestate.com",
                      help="User to email log to")
    parser.add_option("--smtp_secure",
                      action = "store_true",
                      default = False,
                      help="Use secure SSL/TLS login on SMTP server")
    return parser.parse_args()

if __name__ == "__main__":
    (options, args) = parse_options()
    secureparam = None
    if options.smtp_secure:
        secureparam = ()

    testlogger = logging.getLogger("log_stdout_and_email")
    testlogger.setLevel(logging.DEBUG)

    stdouthandler = logging.StreamHandler()
    logformat = logging.Formatter("[%(asctime)s] [%(levelname)8s] --- %(message)s (%(filename)s:%(lineno)s)", "%Y-%m-%d %H:%M:%S")
    stdouthandler.setFormatter(logformat)
    testlogger.addHandler(stdouthandler)
    loghandler = BufferingSMTPHandler((options.smtp_server, options.smtp_server_port),
                                      "collab1-buffered-exceptions@activestate.com",
                                      options.email,
                                      "BufferingSMTPHandler test",
                                      (options.smtp_user, options.smtp_passwd),
                                      secureparam,
                                      capacity=4,
                                      timeout=10,
                                      )
    loghandler.setFormatter(logformat)
    testlogger.addHandler(loghandler)

    # test capacity
    testlogger.debug("** start of capacity test **")
    testlogger.info("  first things first...")
    testlogger.warning("  second things second...")
    testlogger.debug("** end of capacity test **")
    assert len(loghandler.buffer) == 0

    # test timeout
    testlogger.debug("** start of timeout test **")
    testlogger.info("  just one message...")
    testlogger.debug("** end of timeout test **")
    assert len(loghandler.buffer) == 3

    import time
    time.sleep(30)
    assert len(loghandler.buffer) == 0
