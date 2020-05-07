from datetime import datetime, timedelta

def cleanup_views(max_age=timedelta(seconds=60), limit=30):
    from komob import models
    try:
        stale = datetime.now() - max_age
        stale_views = models.ViewObj.objects.zfilter(timestamp__lt=stale)\
                                            .limit(limit)
        for view in stale_views:
            view.delete()
        return len(stale_views)
    except:
        # redisco's zfilter implementation throws exceptions on empty ModelSets
        return -1