from modelset import ModelSet

############
# Managers #
############

class ManagerDescriptor(object):
    def __init__(self, manager):
        self.manager = manager

    def __get__(self, instance, owner):
        if instance != None:
            raise AttributeError
        return self.manager


class Manager(object):
    def __init__(self, model_class):
        self.model_class = model_class

    def get_model_set(self):
        return ModelSet(self.model_class)

    def all(self):
        return self.get_model_set()

    def create(self, **kwargs):
        return self.get_model_set().create(**kwargs)

    def get_or_create(self, **kwargs):
        return self.get_model_set().get_or_create(**kwargs)

    def filter(self, **kwargs):
        return self.get_model_set().filter(**kwargs)

    def exclude(self, **kwargs):
        return self.get_model_set().exclude(**kwargs)

    def get_by_id(self, id):
        return self.get_model_set().get_by_id(id)

    def order(self, field):
        return self.get_model_set().order(field)

    def zfilter(self, **kwargs):
        return self.get_model_set().zfilter(**kwargs)


