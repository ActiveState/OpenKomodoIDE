import base64

def _encode_key(s):
    try:
        return base64.b64encode(str(s)).replace("\n", "")
    except UnicodeError, e:
        return base64.b64encode(s.encode('utf-8')).replace("\n", "")
