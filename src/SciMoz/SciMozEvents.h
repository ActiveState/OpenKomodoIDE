
#ifndef __SCIMOZ_EVENTS__
#define __SCIMOZ_EVENTS__

#include <nsAutoPtr.h>
#include "nsCOMPtr.h"
#include "nsISupports.h"
#include "nsIWeakReference.h"

#include "ISciMozEvents.h"
#include "npapi_utils.h"

// {9DE6C25C-ED73-46b6-A3F9-4308346DFDF7}
#define SCIMOZEVENTSWRAPPER_IID \
  { 0x9de6c25c, 0xed73, 0x46b6, { \
    0xa3, 0xf9, 0x43, 0x8, 0x34, 0x6d, 0xfd, 0xf7 } }

class SciMozEventsWrapper : public ISciMozEvents {
	NS_DECL_ISUPPORTS
	NS_DECL_ISCIMOZEVENTS
	NS_DECLARE_STATIC_IID_ACCESSOR(SCIMOZEVENTSWRAPPER_IID)
public:
	SciMozEventsWrapper(NPObject* aWrappee, NPP aInstance)
		: mWrappee(aWrappee), mInstance(aInstance)
		{}
	NPObject* GetWrappee() { return mWrappee; }
protected:
	virtual ~SciMozEventsWrapper() {}
	nsresult Invoke(const char* aMethodName,  const NPVariant *args, uint32_t argCount);
	koNPObjectPtr mWrappee;
	NPP mInstance;
};

// A linked-list of all event listeners.
class EventListener {
public:
	EventListener(NPP instance, NPObject *listener, bool tryWeakRef, PRUint32 _mask) {
		npp = instance;
		mask = _mask;
		bIsWeak = PR_FALSE;
		pNext = NULL;
		NPVariant iid = { NPVariantType_Void };
		if (tryWeakRef) {
			NPString script = { "Components.interfaces.nsISupportsWeakReference" };
			script.UTF8Length = strlen(script.UTF8Characters);
			if (!NPN_Evaluate(npp,
					  listener,
					  &script,
					  &iid))
			{
				tryWeakRef = false;
			}
		}
		if (tryWeakRef) {
			NPVariant weakVar;
			if (NPN_Invoke(npp,
				       listener,
				       NPN_GetStringIdentifier("QueryInterface"),
				       &iid,
				       1,
				       &weakVar))
			{
				pListener = NPVARIANT_TO_OBJECT(weakVar);
				bIsWeak = PR_TRUE;
			}
		}
		if (!bIsWeak)
			pListener = listener;
	}
  
	// Does one EventListener equal another???
	bool Equals(NPObject *anotherListener) {
		return anotherListener == pListener;
	}

	void * get(ISciMozEvents **pret) {
		if (bIsWeak) {
			NPVariant iid = { NPVariantType_Void };
			NPString script = { "Components.interfaces.ISciMozEvents" };
			script.UTF8Length = strlen(script.UTF8Characters);
			if (!NPN_Evaluate(npp,
					  pListener,
					  &script,
					  &iid))
			{
				return nullptr;
			}
			NPVariant strongRefVar = { NPVariantType_Void };
			if (NPN_Invoke(npp,
				       pListener,
				       NPN_GetStringIdentifier("QueryReferent"),
				       &iid,
				       1,
				       &strongRefVar))
			{
				// got a strong ref
				nsRefPtr<SciMozEventsWrapper> wrapper =
					new SciMozEventsWrapper(NPVARIANT_TO_OBJECT(strongRefVar), npp);
				CallQueryInterface(wrapper.get(), pret);
				return (void *)this;
			}
		} else {
			nsRefPtr<SciMozEventsWrapper> wrapper =
				new SciMozEventsWrapper(pListener, npp);
			CallQueryInterface(wrapper.get(), pret);
			return (void *)this;
		}
		return nullptr;
	}


	koNPObjectPtr pListener;
	PRUint32 mask;
	EventListener *pNext;
	bool bIsWeak;
	NPP npp;
};

class EventListeners {
public:
	EventListeners() {pFirst = nullptr;}
	~EventListeners() {
		EventListener *pLook = pFirst;
		while (pLook) {
			EventListener *pTemp = pLook->pNext;
			delete pLook;
			pLook = pTemp;
		}
	}
	bool Add( NPP instance, NPObject *listener, bool tryWeakRef, PRUint32 mask) {
		EventListener *l = new EventListener(instance, listener, tryWeakRef, mask);
		if (!l || l->pListener == NULL) {
			delete l;
			return false;
		}
		l->pNext = pFirst;
		pFirst = l;
		return true;
	}
	bool Remove( NPP /*instance*/, NPObject *listener ) {
		// No real need to check for weak-reference support.
		// If someone added a weak-reference, then almost
		// by definition they dont want to manage the lifetime
		// themselves.
		EventListener *l = pFirst, *last = nullptr;

		for (;l;l=l->pNext) {
			// KenS: We check for identity using the Equals() member of EventListener
			if (l->Equals(listener)) {
				if (last==nullptr)
					pFirst = l->pNext;
				else
					last->pNext = l->pNext;
				delete l;
				return true;
			}
			last = l;
		}
		NS_WARNING("Attempt to remove a listener that does not exist!\n");
		return false;
	}
	void *GetNext(PRUint32 lookMask, void *from, ISciMozEvents **pret) {
		EventListener *l = from ? ((EventListener *)from)->pNext : pFirst;
		for (;l;l=l->pNext) {
			if (l->mask & lookMask) {
				return l->get(pret);
			}
		}
		return nullptr;
	}
protected:
	EventListener *pFirst;
};

#endif
