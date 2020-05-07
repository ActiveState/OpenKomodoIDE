class Key(str):
    def __getitem__(self, key):
        return Key("%s:%s" % (self, key,))
