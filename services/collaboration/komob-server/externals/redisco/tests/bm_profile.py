from bm_write import *

import hotshot
prof = hotshot.Profile("enum")
d = datetime.fromtimestamp(1571044985)
Person._db.select(11)
bef = Person.objects.zfilter(date__lt=d)
prof.addinfo("part", "1")
prof.start()
len(bef)
prof.stop()
prof.addinfo("part", "2")
aft = Person.objects.zfilter(date__gte=d)
prof.start()
len(aft)
prof.stop()
prof.close()

import hotshot.stats
stats = hotshot.stats.load("enum")
stats.strip_dirs()
stats.sort_stats('time', 'calls')
stats.print_stats(50)

