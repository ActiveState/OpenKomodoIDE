
"""A library for talking to store.as.com.

A quick example:
    
    >>> from activeapis2.storeapi import StoreAPI
    >>> api = StoreAPI()
    >>> order_ids = api.order_ids_from_sso_id(23)   # Trent Mick's order ids.
    >>> api.orders(order_ids)  # Get the order data for each id.
    [<Order 107946 by trentm@activestate.com (canceled, $0.00)>,
     <Order 550339 by trentm@activestate.com (completed, $0.00)>,
     <Order 551112 by trentm@activestate.com (completed, $0.00)>,
     <Order 550342 by trentm@activestate.com (completed, $0.00)>,
     <Order 556955 by TrentM@ActiveState.com (pending, $462.00)>,
     <Order 556956 by TrentM@ActiveState.com (pending, $0.00)>,
     <Order 557103 by TrentM@ActiveState.com (completed, $0.00)>]
"""

from pprint import pprint, pformat
from urllib import urlencode
import datetime

from activeapis2 import utils, dateutils
from activeapis2 import apibase



#---- the main API class

class StoreAPI(apibase.HttpAPIBase):
    DEFAULT_API_URL = "https://store.activestate.com/as/api/"

    class NoLimeAPIError(apibase.APIBase.APIError):
        """Need to talk to the LimeAPI but no `limeapi` argument was given."""

    def __init__(self, *args, **kwargs):
        """Create an API instance.
        
        ... all params from HttpAPIBase ...
        @param limeapi {activeapis2.limeapi.LimeAPI} A `LimeAPI` on which
            the store API can call for Lime info. If not given some Store
            API methods and objects will not work (typically will raise
            `StoreAPI.NoLimeAPIError`).
        """
        self._limeapi = kwargs.get("limeapi")
        if "limeapi" in kwargs:
            del kwargs["limeapi"]
        super(StoreAPI, self).__init__(*args, **kwargs)

    def _get_limeapi(self):
        if self._limeapi is None:
            raise self.NoLimeAPIError()
        return self._limeapi

    def catalog(self):
        """/catalog
        Return the current store catalog.
        
        @returns {list} List of catalog items.
        """
        url = self._api_url + "catalog"
        response = self._request_json(url)
        #pprint(response)
        return response

    def service_list(self, service_group=""):
        """/service/list
        Return a mapping of subscription service_ids to meaningful names
        (e.g. "activeperl_be_1": "ActivePerl Business Edition").
        
        @param service_group {str} Limit the returned services to those in the
            this service group (e.g. "business_edition", "firefly"), if given.
        @returns {dict} Mapping of service_ids to service names.
        """
        url = self._api_url + "service/list/%s" % service_group
        response = self._request_json(url)
        #pprint(response)
        return response

    def order_ids_from_sso_id(self, sso_id):
        """/orders/$sso_id
        Return the order ids for the given account.
        
        @param sso_id {int} SSO id of the account.
        @returns {list} List of order ids.
        @raises {NotFoundError} If the sso_id is unknown to the store,
            which implies that there are no orders for this user.
        """
        url = self._api_url + "orders/" + str(sso_id)
        response = self._request_json(url)
        #pprint(response)
        return response

    def pending_order_ids_from_sso_id(self, sso_id):
        """/orders/pending/$sso_id
        Return the ids for *pending* orders for the given account. Pending
        orders are manual orders (i.e. those created by internal ActiveState
        customer service) that haven't yet been completed.
        
        @param sso_id {int} SSO id of the account.
        @returns {list} List of order ids.
        @raises {NotFoundError} If the sso_id is unknown to the store,
            which implies that there are no orders for this user.
        """
        url = self._api_url + "orders/pending/" + str(sso_id)
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def raw_orders_counts(self, sso_ids):
        """/orders/counts/$sso_ids
        
        Note: Currently the response from this API method is frustrating:
        - If the sso_id is known: {"sso_id": $sso_id, "num_orders": $num_orders}
          Good.
        - If one sso_id of many is now known (or is bogus): no entry in the
          returned list of results. Annoying, but can deal with it.
        - If *none* of the given SSO ids is known: returns a 404 response.
          Grrr.
        
        @param sso_ids {list} A list of SSO ids for which to gather counts.
        @returns {list} A list of dicts of the form:
                {'sso_id': $sso_id, 'num_orders': 42}
            For SSO ids that are unknown or bogus, there is no entry. Note
            that this means you can't rely on the index of the list matching
            the input `sso_ids` index.
        @raises {NotFoundError} if none of the SSO ids are known.
        """
        url = (self._api_url + "orders/counts/"
            + ','.join(str(id) for id in sso_ids))
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def num_orders_from_sso_ids(self, sso_ids):
        """Return a mapping of sso_id -> num_orders.
        
        Builds on `raw_orders_counts`.
        
        @returns {dict} Mapping of sso_ids to number of orders. If an
            sso_id was unknown or bogus, then this the count for that
            one will be zero.
        """
        mapping = {}
        sso_id_set = set(sso_ids)
        try:
            for item in self.raw_orders_counts(sso_ids):
                mapping[item["sso_id"]] = int(item["num_orders"])
                sso_id_set.remove(item["sso_id"])
        except self.NotFoundError:
            pass
        for sso_id in sso_id_set:
            mapping[sso_id] = 0
        return mapping
    
    def orders_from_po_number_substr(self, po_number_substr):
        """/orders/lookupbyponumber/$term
        
        Return the orders with a PO number that matches the given search
        term. This is a case-insensitive substring match.
        
        @param po_number_substr {str} A PO number substring for which to
            search.
        @returns {list} List of `Order` instances. The matching orders.
        @raises {NotFoundError} if the substring is not found.
        """
        if not po_number_substr:
            return []
        url = self._api_url + "orders/lookupbyponumber/" + str(po_number_substr)
        response = self._request_json(url)
        #pprint(response)
        if not isinstance(response, list):
            # Guard against unexpect results from the Store API here. For
            # example was getting a 200 status, but `'404: Not found.'`
            # reponse content for a while.
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return [Order(d, self) for d in response]
    
    def orders(self, order_ids):
        """Return `Order` instances for the given order ids.
        
        @param order_ids {list} Order ids for which to get info.
        @returns {list} List of `Order` instances. Elements for non-existant
            or zombie (see bug 84301) order ids are `None`.
        """
        orders = []
        for d in self.raw_orders(order_ids):
            if d and "order_id" in d:
                orders.append(Order(d, self))
            else:
                orders.append(None)
        return orders

    def raw_orders(self, order_ids):
        """order/$id1,$id2,...
        Return order information for the given order ids.

        Note: Somewhat confusingly this method is called "orders" plural
        but uses the API url "order" singular. <shrug/>

        @param order_ids {list} Order ids for which to get info.
        @returns {list} The list of raw 'order' dicts returned by the API.
            The element for non-existant order ids are `False`.
            (TODO:XXX that might be `null`)
        """
        if not order_ids:
            return []
        url = (self._api_url + "order/"
            + ','.join(str(id) for id in order_ids))
        response = self._request_json(url)
        #pprint(response)
        return response
    
    def uid(self, sso_id):
        """uid/$sso_id
        Return the Store's uid for the user with the given SSO id.

        @param sso_id {int} SSO id of the user.
        @returns {int} The Store's UID for this user.
        """
        url = self._api_url + "uid/" + str(sso_id)
        response = self._request_json(url)
        #pprint(response)
        return response["uid"]
    
    def sso_id(self, uid):
        """ssoid/$uid
        Return the SSO id for the given Store's uid for the user.

        @param uid {int} The Store's UID.
        @returns {int} The SSO id.
        """
        url = self._api_url + "ssoid/" + str(sso_id)
        response = self._request_json(url)
        #pprint(response)
        return response["sso_id"]
    
    def getmanualorder(self, sso_id):
        """getmanualorder/
        Get a manual order (creating one if necessary) for the given account.

        @param sso_id {int} The id of the account for which to create an
            order.
        @returns {Order} The order.
        """
        url = self._api_url + "getmanualorder"
        data = {
            "sso_id": sso_id,
        }
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return Order(response, self)
    
    def addtoorder(self, sso_id, csr_sso_id, product_id, license_ids=None,
            add_subscription=False, is_recurring=True):
        """addtoorder/
        
        Add an item to the manual order for the given user.
        
        @param sso_id {int} The id of the account whose manual order we're
            adding to.
        @param csr_sso_id {int} The id of the (internal) person
            creating/adding-to the manual order.
        @param product_id {int} ID for the product to add. This is the
            "store_id" field in the "Product" dict from the Lime API.
        @param license_ids {list} A list of lime license ids if this is
            an upgrade. Typcically this is a list with one element, e.g.
            just upgrading a single Komodo IDE license to the latest version.
            XXX The store doesn't actually accept multiple license ids;
            if it were ever called this way, it would break.  Should change
            this method accordingly; no time to fix now.
        @param add_subscription {bool} True if a subscription should
            be added along with the product being purchased (or should be added
            *as* the product being purchased, if no product is being specified).
        @param is_recurring {bool} Only meaningful if add_subscription is True;
            the added subscription will have recurring billing if this is True,
            and be non-recurring otherwise.
        
        @returns {Order} The order.
        @raises {self.APIError}
        """

        url = self._api_url + "addtoorder"
        data = {
            "sso_id": sso_id,
            "csr_sso_id": csr_sso_id,
        }
        if product_id:
            data["lime_product_id"] = product_id
        if license_ids:
            data["license_id"] = ','.join([str(id) for id in license_ids])
        if add_subscription:
            data["with_subscription"] = 1
        if not is_recurring:
            data["recurring_billing"] = 0
        
        response = self._request_json(url, "POST", data)
        #pprint(response)
        if not isinstance(response, dict):
            # Guard against unexpect results from the Store API here.
            raise self.APIError("unexpected response from %s: expected dict:\n"
                "  url: %s\n  post data: %r\n  "
                "response: %r\n" % (url, url, data, response))
        if response.get("error"):
            # This is an error response from the API. E.g.:
            #   {u'eror_message': u"Can't renew this pro Studio, it expired on 2009-08-12 00:00:00",
            #    u'error': 1}
            # Re "eror_message" typo: see bug 84644 to fix this.
            msg = response.get("error_message") or response.get("eror_message")
            raise self.APIError(msg)
        return Order(response, self)
    
    def addtocart(self, sso_id, lime_product_id=None,
            license_ids=None, add_subscription=False):
        """addtocart/$sso_id
        
        Add something to the user's cart.

        Usage:
        1. Add a product to the user's cart:
            api.addtocart(sso_id=ID, lime_product_id=ID)
        2. Add an upgrade to an existing owned product to the user's cart:
            api.addtocart(sso_id=ID, lime_product_id=ID,
                license_ids=[IDS...])
        3. Add a subscription for an existing product to the user's cart:
            api.addtocart(sso_id=ID, license_id=ID, add_subscription=True)

        Dev notes on misleading "product_id", "lime_product_id",
        "store nid's", "store SKUs", and the separation of "services" for
        all this:
        - The `product_id` argument here corresponds to 
          <http://lime.activestate.com/products>.
        - This correlates *somewhat* to "nid" values in
          <https://store.activestate.com/as/api/catalog>. *However*, note
          that "Komodo IDE" in Lime (id 8) is the "Komodo IDE Upgrade" SKU
          in the store catalog, *not* the SKU for a "Komodo IDE" new purchase.
        - The Store's implementation of the API is using the given
          `lime_product_id` as a kind of a "group" id and choosing the
          appropriate SKU, for some definitely of "appropriate".
        
        @param sso_id {int} The id of the person whose cart to add to.
        @param product_id {int} ID for the product to add. This is the
            "store_id" field in the "Product" dict from the Lime API,
            <http://lime.activestate.com/products>.
        @param license_ids {list} A list of lime license ids if this is
            an upgrade. Typcically this is a list with one element, e.g.
            just upgrading a single Komodo IDE license to the latest version.
            XXX The store doesn't actually accept multiple license ids;
            if it were ever called this way, it would break.  Should change
            this method accordingly; no time to fix now.
        @param add_subscription {bool} True if a subscription should
            be added along with the product being purchased (or should be added
            *as* the product being purchased, if no product is being specified).
        @returns {dict} The cart dict.
        """
        url = self._api_url + "addtocart"
        data = {
            "sso_id": sso_id,
        }
        if lime_product_id:
            data["lime_product_id"] = lime_product_id
        if license_ids:
            data["license_id"] = ','.join([str(id) for id in license_ids])
        if add_subscription:
            data["with_subscription"] = 1
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return response
    
    def servicechange(self, sso_id, subscription_id, service_account_id,
            service_id):
        """service/change
        
        Change a subscription/service level.
        
        @param sso_id {int} The id of the person making the change.
        @param subscription_id {int} ID for the particular subscription in
            Lime.
        @param service_account_id {int} The service account id. This is the
            ID for the association of this service with this account; the ID
            that is shared between sites. This is a one-to-one mapping with
            the `subscription_id` so technically this is a redundant arg.
        @param service_id {str} The ID of the service to which this
            subscription is being changed. E.g. For a change in Firefly
            subscription to Firefly Professional this will be
            "firefly_professional_$version" -- where version is the current
            Firefly Professional service being offered. One must get
            what that latest service_id is from ActiveData.
        @returns {limeapi.Subscription} The upgraded subscription.
        """
        from activeapis2.limeapi import Subscription
        url = self._api_url + "service/change"
        data = {
            "sso_id": sso_id,
            "subscription_id": subscription_id,
            "service_account_id": service_account_id,
            "service_id": service_id,
        }
        response = self._request_json(url, "POST", data)
        #pprint(response)
        if not isinstance(response, list) or 'service_id' not in response[0]:
            raise self.APIError("unexpected response from %s: %r "
                % (url, response))
        return Subscription(response[0], self)

    def servicecancel(self, sso_id, subscription_id, service_account_id):
        """service/cancel
        
        Cancel a subscription.
        
        @param sso_id {int} The id of the person making the change.
        @param subscription_id {int} ID for the particular subscription in
            Lime.
        @param service_account_id {int} The service account id. This is the
            ID for the association of this service with this account; the ID
            that is shared between sites. This is a one-to-one mapping with
            the `subscription_id` so technically this is a redundant arg.
        @returns ???
        """
        url = self._api_url + "service/cancel"
        data = {
            "sso_id": sso_id,
            "subscription_id": subscription_id,
            "service_account_id": service_account_id,
        }
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return response
    
    def serviceenable(self, sso_id, subscription_id):
        """service/enable
        
        Enable an already-existent subscription.  Practically speaking, this
        should only be a subscription which was cancelled, and is being uncancelled
        before reaching its expiry date.
        
        @param sso_id {int} The id of the person making the change.
        @param subscription_id {int} ID for the particular subscription in Lime.
        @returns The associated updated Lime subscription, or some Monexa error
            blob in the case of an error.
        """
        url = self._api_url + "service/enable"
        data = {
            "sso_id": sso_id,
            "subscription_id": subscription_id,
        }
        response = self._request_json(url, "POST", data)
        #pprint(response)
        return response
    
    def service_billed_up_to(self, service_account_id):
        """ service/billed_up_to
        Given the service_account_id of a Monexa subscriber, returns the
        billed-up-to date of that subscriber, or the store's best estimation if
        none is set.
        
        @param service_account_id {int} The account id of the Monexa Subscriber.
        @returns {datetime.date} The date, or None if for some reason one can't
            even be guessed at (should probably never happen).
        """
        url = self._api_url + "service/billed_up_to/%s" % service_account_id
        response = self._request_json(url, "GET")
        if isinstance(response, list):  # list of one element - the date string
            return dateutils.date_strptime(response[0], "%Y-%m-%d")
        else:
            return None
    
    def ipappsid(self, sso_id):
        """ipappsid/$sso_id
        Return IPApps's user id (aka for billing.as.com) for the user
        with the given SSO id.

        @param sso_id {int} SSO id of the user.
        @returns {int} IPApps's UID for this user.
        """
        url = self._api_url + "ipappsid/" + str(sso_id)
        response = self._request_json(url)
        #pprint(response)
        return response["ipappsid"]
    

class Order(object):
    """A light wrapper around a Store API "order" dict to make it easier
    to work with.
    """
    def __init__(self, raw, api):
        """
        @param raw {dict} The raw Store API order dict.
        @param api {StoreAPI} The Store API instance. This is used for
            exceptions and for calling out to the Lime API for Lime info.
        """
        # Some of the "*_name" fields are only filled in by the API if
        # the associated id field is non-zero. That makes some of the
        # processing below more difficult. Just add empty entries here.
        for name in ("billing_country_name", "billing_zone_name",
                "delivery_country_name", "delivery_zone_name"):
            if name not in raw:
                raw[name] = ""
        self._raw = raw
        self._api = api

    def __str__(self):
        bits = [self._raw.get("order_status", "(unknown status)")]
        if "order_total" in self._raw:
            bits.append("$%.2f" % self._raw["order_total"])
        return "Order %d by %s (%s)" % (self._raw["order_id"],
            self._raw["primary_email"] or '(no primary email)',
            ', '.join(bits))

    def __repr__(self):
        return "<%s>" % self

    def pformat(self):
        return pformat(self._raw)

    @property
    def order_id(self):
        return self._raw["order_id"]
    @property
    def primary_email(self):
        return self._raw["primary_email"]
    @property
    def uid(self):
        """
        @returns {int} The store's user id for the user for whom the
            order was created.
        """
        return int(self._raw["uid"])
    @property
    def sso_id(self):
        """
        @returns {int} The SSO id for the user for whom the order was created
            or None if there is no SSO id for this order. The latter can
            happen if, e.g., the "primary_email" associated with an order
            is not an account in account.as.com. See bug 85104 for an
            example of where this happened.
        """
        try:
            return int(self._raw["ssoid"])
        except KeyError:
            return None
    @property
    def order_total(self):
        """The order dict has 'null' if the order was for free."""
        return self._raw["order_total"] or 0.0
    @property
    def order_status(self):
        return self._raw["order_status"]
    @property
    def created_datetime_utc(self):
        """Order creation time (UTC).
        
        Our store's order times are local time (Vancouver, -0800).
        """
        return self.created_datetime - datetime.timedelta(hours=8)
    @property
    def modified_datetime_utc(self):
        return self.modified_datetime - datetime.timedelta(hours=8)
    @property
    def created_datetime(self):
        """Order creation time (local time)."""
        return datetime.datetime.fromtimestamp(float(self._raw["created"]))
    @property
    def modified_datetime(self):
        return datetime.datetime.fromtimestamp(float(self._raw["modified"]))
    @property
    def po_number(self):
        """The purchase order (a free field in the order data). This
        returns none if no PO number was added.
        """
        return self._raw.get("as_order_po_number")
    @property
    def products(self):
        return self._raw["products"]
    @property
    def billing_contact(self):
        city_str = (int(self._raw["billing_zone"])
            and "%(billing_city)s, %(billing_zone_name)s, %(billing_country_name)s" % self._raw
            or "%(billing_city)s, %(billing_country_name)s" % self._raw)
        bits = [
            "%(billing_first_name)s %(billing_last_name)s" % self._raw,
            self._raw["billing_company"],
            self._raw["billing_street1"],
            self._raw["billing_street2"],
            city_str,
            str(self._raw["billing_postal_code"] or ""),  # *sometimes* an int in API
        ]
        if self._raw["billing_phone"]:
            bits.append("phone: %(billing_phone)s" % self._raw)
        return '\n'.join([b for b in bits if b.strip(' ,')])
    @property
    def delivery_contact(self):
        city_str = (int(self._raw["delivery_zone"])
            and "%(delivery_city)s, %(delivery_zone_name)s, %(delivery_country_name)s" % self._raw
            or "%(delivery_city)s, %(delivery_country_name)s" % self._raw)
        bits = [
            "%(delivery_first_name)s %(delivery_last_name)s" % self._raw,
            self._raw["delivery_company"],
            self._raw["delivery_street1"],
            self._raw["delivery_street2"],
            city_str,
            str(self._raw["delivery_postal_code"] or ""),  # *sometimes* an int in API
        ]
        if self._raw["delivery_phone"]:
            bits.append("phone: %(delivery_phone)s" % self._raw)
        return '\n'.join([b for b in bits if b.strip(' ,')])
    @property
    def items(self):
        """Returns the ordered set of rows for the items in, e.g.,
        an invoice; including the subtotal and total rows.
        
        @returns {list of OrderSummaryRow}
        """
        rows = []
        for product in self._raw["products"]:
            rows.append(OrderProductItem(self.order_id, product))
        for line_item in self._raw["line_items"]:
            rows.append(OrderLineItem(self.order_id, line_item))
        rows.append(OrderLineItem(self.order_id, {"title": "Total",
            "amount": self.order_total, "type": "total"}))
        return rows

    _licenses_cache = False # `None` means error determining.
    @property
    def licenses(self):
        """Return the list of licenses that came with this order.
        
        @returns {list of activeapis2.limeapi.License} or None if there
            was an error retrieving this info.
        """
        if self._licenses_cache is False:
            limeapi = self._api._get_limeapi()
            try:
                self._licenses_cache = limeapi.licenses_from_order_id(self.order_id)
            except limeapi.NotFoundError:
                self._licenses_cache = None
        return self._licenses_cache

    _subscriptions_cache = False # `None` means error determining.
    @property
    def subscriptions(self):
        """Return the list of subscriptions that came with this order.
        
        @returns {list of activeapis2.limeapi.Subscription} or None if there
            was an error retrieving this info.
        """
        if self._subscriptions_cache is False:
            limeapi = self._api._get_limeapi()
            try:
                self._subscriptions_cache = limeapi.subscriptions_from_order_id(self.order_id)
            except limeapi.NotFoundError:
                self._subscriptions_cache = None
        return self._subscriptions_cache


class OrderItem(object):
    order_id = None
    type = None
    title_text = None
    title_html = None
    total = None
class OrderProductItem(OrderItem):
    type = "product"
    def __init__(self, order_id, product):
        self.order_id = order_id
        self.product = product
        self.sku = product["model"]
        self.qty = int(product["qty"])
        self.price = float(product["price"])
        self.total = self.price * self.qty
        self.upgraded_serial_num = product["data"].get("license_key")
        if self.upgraded_serial_num:
            self.title_html = "%s (upgrading <a href='/licenses/%s/'>%s</a>)" % (
                product["title"], self.upgraded_serial_num,
                self.upgraded_serial_num)
            self.title_text = "%s (%s)" % (product["title"],
                self.upgraded_serial_num)
        else:
            self.title_html = self.title_text = product["title"]
    @property
    def monexa_desc(self):
        """A description for Monexa line items. Limit 64 chars.
        
        Currently the store is using a pattern like this:
            Order NNNNN: 5 KMDO/Komodo IDE
        which we want to try to emulate as much as possible.
        """
        s = "Order %s: %s %s/%s" % (self.order_id, self.qty, self.sku,
            self.title_text)
        return s[:64]

class OrderLineItem(OrderItem):
    def __init__(self, order_id, line_item):
        self.order_id = order_id
        self.title_html = self.title_text = line_item["title"]
        self.type = line_item.get("type", "line_item")
        self.total = float(line_item["amount"])
    @property
    def monexa_desc(self):
        """A description for Monexa line items. Limit 64 chars.
        
        For *product* line items the store is currently using a pattern like
        this:
            Order NNNNN: 5 KMDO/Komodo IDE
        which we want to try to emulate as much as possible.
        
        Note that subtotals, totals, etc. line items in invoices should *not*
        go to Monexa's API. We guard against that here.
        """
        if self.type in ("total", "subtotal", "tax_subtotal"):
            raise RuntimeError("error creating Monexa description for line "
                "item: should not send a line item of type %r to monexa"
                % self.type)
        s = "Order %s: %s" % (self.order_id, self.title_text)
        return s[:64]


