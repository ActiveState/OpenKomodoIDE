#!/usr/bin/env python
import time
import random
from redisco import models
from redisco.connection import _get_client
from datetime import datetime
import timeit
from functools import partial

class Person(models.Model):
    first_name = models.Attribute()
    last_name = models.Attribute()
    address = models.Attribute()
    description = models.Attribute()
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateTimeField()

if __name__ == '__main__':
    db = _get_client()
    db.select(11)
    db.flushdb()

    def rand_date():
        s = random.randrange(883584000, 1577808000)
        return datetime.fromtimestamp(s)


    def init():
        persons = []
        for i in range(100000):
            p = Person(first_name=random.choice(('Tim', 'Alec', 'Jim')),
                       last_name=random.choice(('Medina', 'Baldwin', "O'brien")),
                       address="36174 Kraig Well",
                       description="cum et corporis hic dolorem ullam omnis aut quis enim quisquam rem earum est commodi at asperiores autem id magni consectetur dignissimos vero ut et perferendis sequi voluptas voluptatibus assumenda molestiae tempore debitis et consequuntur ipsa voluptatum ut facilis officia dolores quia fuga quia aliquam architecto tenetur iure velit dicta ad alias et corrupti est sit quod possimus quasi accusantium est qui totam autem ea optio veritatis et et nostrum modi quibusdam natus laboriosam aut aspernatur et vel eaque soluta rerum recusandae vitae qui quo voluptatem exercitationem deserunt non placeat ut inventore numquam et enim mollitia harum labore deleniti quia doloribus ipsam nisi sed nihil laudantium quas dolor occaecati eum in aut ex distinctio minima quia accusamus ut consequatur eos adipisci repellendus voluptas expedita impedit beatae est fugiat officiis sint minus aliquid culpa libero nihil omnis aperiam excepturi atque dolor sunt reprehenderit magnam itaque repellat provident eos et eum sed odio fugit nesciunt dolorum sapiente qui pariatur sit iusto tempora ipsum maiores dolores nobis doloremque non facere praesentium explicabo aut dolorem qui veniam nemo ut suscipit eveniet voluptatem eligendi esse quis ab eius necessitatibus a delectus repudiandae molestiae vel aut ut qui consequatur quidem perspiciatis qui quaerat saepe neque animi voluptate non omnis in consequatur cupiditate quo ducimus velit rerum dolore nam et quos illum laborum id sunt ea molestias voluptas et est sint quam sit porro sed unde rerum voluptates temporibus odit nulla ratione blanditiis amet voluptatem aut cumque quae iste error similique voluptatem illo maxime reiciendis incidunt"
                       )
            p.date = rand_date()
            persons.append(p)
        return persons

    def save_persons(persons):
        for person in persons:
            person.save()

    tsave = partial(save_persons, init())

    def enum_persons():
        for p in Person.objects.all():
            p.first_name
            p.last_name
            p.address
            p.description

    n = datetime.now()

    def filter_lt(n):
        res = Person.objects.zfilter(date__lt=n)
        for p in res:
            p.date
        print "Found %d lt" % len(res)

    def filter_gte(n):
        res = Person.objects.zfilter(date__gte=n)
        for p in res:
            p.date
        print "Found %d gte" % len(res)

    tfilter_lt = partial(filter_lt, n)
    tfilter_gte = partial(filter_gte, n)

    st = timeit.timeit(tsave, number=1)
    en = timeit.timeit(enum_persons, number=1)
    f1 = timeit.timeit(tfilter_lt, number=1)
    f2 = timeit.timeit(tfilter_gte, number=1)

    print "Save %f" % st
    print "enum %f" % en
    print "Filter lt %f" % f1
    print "Filter gte %f" % f2
