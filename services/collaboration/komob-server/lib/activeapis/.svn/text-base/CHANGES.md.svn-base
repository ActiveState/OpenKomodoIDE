# activeapis change log

See TODO.txt for planned upcoming changes.

Items in [brackets] indicates a module name for which there is an
incompatible change for users of that module. The [all] marker indicates an
incompat change in all api modules.


## activeapis 2.0.30

- [storeapi] s/add_maintenance/add_subscription/ in addtoorder and addtocart
  method parameters.
- [storeapi] Remove store_service_id parameter from addtocart (it's not actually
  supported by the store).


## activeapis 2.0.29

- [storeapi] Remove bundle_id from addtoorder and addtocart methods; the store
  doesn't actually acknowledge any such parameter.
- storeapi: Add add_maintenance parameter to the addtocart method.
- storeapi: Add add_maintenance and is_recurring parameters to the addtoorder
  method.
- limeapi: Add License.is_maintainable, License.has_maintenance_subscription,
  and Subscription.is_maintenance methods.
- [limeapi] Add a fourth element to the License.available_upgrades tuples, a
  boolean indicating whether the upgrade path must implicitly include a
  maintenance subscription.
- [limeapi] Remove prostudio-related methods which no longer make sense in a
  post-maintenance world: extend_prostudio_subscription(), License.is_expired
  (licenses themselves no longer have expiry dates), License.expiry_date, and
  License.is_renewable().
- limeapi: Add subscription renewal-related stuff: SubscriptionRenewal wrapper
  class, subscription_renewals() api method, Subscription.renewals property,
  and Subscription.valid_until_date, which needs to look at the subscription's
  renewals.
- storeapi: Add serviceenable() method for re-enabling a cancelled but not yet
  expired subscription.
- Update the Komodo upgrade paths allowed by limeapi, coincident with the
  Komodo 6 release.
- storeapi: Add service_billed_up_to() method for getting the billed-up-to date
  for a given subscription.

## activeapis 2.0.28

- Update to limeapi's upgrade paths: move PDK8->APPS from being internal-only
  to publicly-accessible.


## activeapis 2.0.27

- Add marketoapi.py, currently containing only MarketoAPI.newsletter_signup().


## activeapis 2.0.26

- Update the PDK upgrade paths allowed by limeapi, coincident with the PDK 9
  release.


## activeapis 2.0.25

- Add to limeapi the `License.all_upgrades` property, similar to
  `License.available_upgrades` but including upgrade paths restricted from
  customer use.
- In limeapi make the upgrade path from PDK 7 to APPS a "restricted" upgrade
  (appears in `all_upgrades` but not in `available_upgrades`).


## activeapis 2.0.24

- Change limeapi.py's `Subscription.license` property to not break when there's
  no associated Transaction.


## activeapis 2.0.23

- [limeapi] Rename `LimeAPI.subscription_extend()` to
  `LimeAPI.extend_prostudio_subscription()` to be clear about what the method
  affects (Prostudiosubscriptions, not Subscriptions).
- Add `LimeAPI.extend_subscription()` method to set the expiry date on a
  Subscription.
- Add limeapi.py `Subscription.upgraded_to_subscription` property.
- Change limeapi.py `Subscription.__str__` to use the Subscription's (Lime) id
  in place of the service_account_id (which may not exist).


## activeapis 2.0.22

- In limeapi.py, add `Subscription.is_expired` property.


## activeapis 2.0.21

- Add optional `service_group` filter parameter to `StoreAPI.service_list()`.
- Make LimeAPI's `create_license()` and `create_subscription()` only set fields
  for which values are actually provided.


## activeapis 2.0.20

- Add `LimeAPI.create_license()` and `LimeAPI.create_subscription()`.
- Bugfix in apibase.py where HttpAPIBase._raise_on_socket_error() tries to
  unpack a tuple without knowing its length.


## activeapis 2.0.19

- Change APIBase.HTTPError.__str__ to be more verbose by default: clipping
  the response content at 2000 chars instead of 100. The shorter limit
  ended up hiding too much info.
- Add `AccountAPI.accounts_from_user_ids()`, a bulk version of
  `account_from_user_id()`.
- change User-Agent for XmlrpcAPIBase to "activeapis2 xmlrpclib.py"


## activeapis 2.0.18

- Added `limeapi.License.product` property
- Added `limeapi.Subscription.license_id` and `limeapi.Subscription.license`.
- Added `limeapi.Subscription.is_recurring`.


## activeapis 2.0.17

- Added LimeAPI `License.subscription` property for getting a Subscription
  object for the subscription data associated with a license (when it exists).
- LimeAPI's `licenses()` and `raw_licenses()` get an additional optional
  argument (`include_related`) to allow deeper recursion in fetching related
  model data from Lime (to support the `License.subscription` property).
- Added `LimeAPI.subscription_license_ids_from_enduser_sso_id()` for getting,
  given a user, licenses which are assigned to that user and which have
  associated subscriptions (i.e. Business Edition).
- Changed LimeAPI `License.product_and_licver()` to support BE licenses, relying
  on...
- Added `LimeAPI._store_service_name_from_service_id()` and
  `StoreAPI.service_list()` for getting a meaningful product name from a
  `Subscription.service_id`.
- Added AccountAPI `Account.api_password` property.


## activeapis 2.0.16

- Update LimeAPI's `sso.utils.get_user_api_response_data` usage when being
  run *on* account.activestate.com.
- Added a `setup.py` to allow `python setup.py sdist` for putting `activeapi2`
  releases in a private ActiveState packages repo (allowing usage of
  pip/buildout/pypm/virtualenv to get `activeapis2` as a dependency.


## activeapis 2.0.15

- Add an `activeapis2.get_api(<apiname>)` convenience function.
- Add `fireflyapi.set_subscription()` method for creating/updating
  subscriptions.
- Add `limeapi.recent_subscriptions()` method for getting the most recently
  created subscriptions
- Add fireflyhubapi.py - an API for fireflyhub.com.


## activeapis 2.0.14

- Trap `httplib.BadStatusLine` exception and re-raise as an `APIError`.
- [fireflyapi] Drop usage of `id` field in `fireflyapi.Subscription`. Firefly guys have
  dropped it: unused and in the way of distributed Firefly.
- Add `created_datetime_utc` and `modified_datetime_utc` attributes to
  `storeapi.Order` (the non-"_utc" equivalents are local time to Vancouver).
- Add `title_text`, `order_id` and `monexa_desc` attributes to
  `storeapi.OrderLineItem` to facilitate working with Monexa transation data.
  The `monexa_desc` output matches as closely as possible the descriptions
  that the store is currently generating for Monexa billing line item
  descriptions.



## activeapis 2.0.13

- Add `AccountAPI.accountchanges()` method.
- Add some more 4xx HTTP error code exceptions to `HttpApiBase`: 
      UnauthorizedError
      PaymentRequiredError
      MethodNotAllowed
      NotAcceptableError
      ProxyAuthenticationRequiredError
- Fix `activeapis.APIFactory.get(...)` to pass through the `http_cache_dir`
  setting to `fireflyapi.FireflyAPI`. Previously it was not doing this.


## activeapis 2.0.12

- Add `LimeAPI.subscriptions_from_order_id`.
- Add `storeapi.Order.subscriptions`: gives the list of subscriptions in this order.
- Add `LimeAPI.subscription_statuses` method and SubscriptionStatus class.
- Add `LimeAPI.total_counts` method.


## activeapis 2.0.11

- Add `user_account` attribute to `limeapi.Subscription`.
- Add `created_date` and `modified_date` attributes to `limeapi.Subscription`.
- Add `per_page` argument to `NotificationsAPI.notifications()` method. This
  was recently added to the site's API.
- Add `LimeAPI.counts_from_sso_ids`.
- Deprecate `LimeAPI.raw_licenses_counts` and
  `LimeAPI.num_licenses_from_sso_ids` in favour of `counts_from_sso_ids`. The
  new one adds a count of subscriptions for each SSO id.


## activeapis 2.0.10

- Add new `LimeAPI.Subscription` properties: `is_cancelled`, `expiry_date`, `is_deleted`.
- Add new LimeAPI methods: `expired_subscription_ids` and `delete_subscription`.
- Add `LimeAPI.all_subscription_ids_from_sso_id`


## activeapis 2.0.9

- Guard against `storeapi.Order.sso_id` not being available (as happened in bug
  85104).


## activeapis 2.0.8

- Fix `LimeAPI.safariusers`, accidentally broken way back in v2.0.0.
- Fix for `LimeAPI.num_licenses_from_sso_ids` for exception hierarchy changes a
  number of versions ago.


## activeapis 2.0.7

- Add `limeapi.License.safe_latest_order` to support use in a Django template
  where error handling isn't so convenient.


## activeapis 2.0.6

- [fireflyapi] Correct default API url to be to firefly.activestate.com.


## activeapis 2.0.5

- Updates to `limeapi.Subscription` and fixes for using it from
  `StoreAPI.servicechange`.
- Update expected retval from `StoreAPI.servicechange` -- it returns a list
  with one subscription record instead of just the subscription record.
- Add "catalog" method to StoreAPI.


## activeapis 2.0.4

- New `APIBase.SocketError` handling for all APIs: socket errors during an HTTP
  request are transformed to a `SocketError` instance (or one of its
  specialized subclass). `SocketError` derives from `APIBase.APIError` so this
  makes error handling for requests easier. Current specialized socket error
  classes are: `TimeoutError` and `HostDownError`.
- [fireflyapi] update XmlrpcAPIBase (and hence FireflyAPI) to use a custom
  transport that using the httplib2 HTTP library that we are using elsewhere.
  This adds support for better basic auth handling (don't need to shove in the
  URL now) and for setting a connection timeout. This also brings in the
  regular HttpAPIBase set of HTTPError exception hierarchy handling.
- [limeapi] Drop deprecated `License.purchaser_id`, `License.purchaser_account`
  and `License.transaction` attributes from limeapi. Use the new "latest_*" APIs
  instead.
- Added `LimeAPI.void_license` method.
- Add `License.latest_purchaser_id` and `License.latest_purchaser_account`
  to limeapi.
- Add `StoreAPI.sso_id()` to get the SSO id from a Store UID. As well
  `storeapi.Order` now has a `sso_id` attribute.
- [storeapi] Change `Order.purchase_order` to `Order.po_number` as is used by
  everyone else.
- Add `store_service_id` argument to `storeapi.StoreAPI.addtocart()` API. This
  argument must be used instead of `lime_product_id` for adding a particular
  service to the user's cart.
- [storeapi] Change `product_id` argument to `StoreAPI.addtocart(...)` to
  `lime_product_id` to match the name given to the API. The `addtocart` API has
  some unexpected subtleties and I don't want to add to the confusion.
- Add `servicechange` and `servicecancel` methods to `storeapi.StoreAPI`.
- Add `fireflyapi.Subscription` API object these `FireflyAPI` methods:
  `subscriptions_from_username` and `subscription_from_service_account_id`.
- Updated default dispatch of `XmlrpcAPIBase`-based classes to look for a
  `_override_{attrname}` override handler on the API class before falling
  back to passing attributes directly to the XML-RPC proxy. See the
  `__getattr__` docstring in "apibase.py" for details.
- [limeapi] Change `LimeAPI.subscription_from_service_account` name to
  `LimeAPI.subscription_from_service_account_id`.
  


## activeapis 2.0.3

- `apibase.XmlrpcAPIBase` and the new "fireflyapi.py" module.
- Separate `apibase.APIBase` and `apibase.HttpAPIBase`. The latter is a
  specialization for direct-HTTP-based APIs. This is prep for a Firefly API
  module that is XML-RPC-based -- still HTTP under the hood, but not using
  the base HTTP facilities of HttpAPIBase so should be kep separate.
- Tweaks to `limeapi.License.pformat` and `storeapi.Order.pformat` to facility
  pprinting the internal dicts in Django views.
- New `limeapi.Subscription` class for Lime subscriptions; subscription read methods (`subscriptions`, `subscription_from_service_account`, `subscription_ids_from_sso_id`); and `set_subscription_status` write method.


## activeapis 2.0.2

- Fix import dependency in `utils.py` that broke notificationsapi.


## activeapis 2.0.1

- Added `limeapi.License.latest_order` as a replacement for the removed
  `limeapi.License.order`.
- Added `limeapi.License` accessors: `is_deleted`, `prostudio_id`,
  `prostudiosubscription_id`, `safari_username`, `safari_password`,
  `is_fgl`, `is_student`, `is_stolen`.
- [limeapi] `License.safari_included` renamed to `License.is_safari_included`.
- Add `activeapis2.django_get_api` that is a light wrapper around
  `activeapis2.APIFactory` using `django.conf.settings.ACTIVEAPIS_SETTINGS`.
- Add `activeapis2.APIFactory(<settings>)` to handle (a) settings for
  alternate API endpoint URLs for dev/staging environments and (b) the
  details of sub-API instances (e.g. LimeAPI wants an AccountAPI instance
  for account info). See the class docstring for details.


## activeapis 2.0.0

- [limeapi] Significant changes in `limeapi.License`: no longer a dict; most
  accessors are now properties; `product_str` is deprecated, use
  `product_and_licver`; `license.transaction` is deprecated; `license.order`
  is deprecated and *removed* (use `license.latest_order` in v2.0.1);
  `license.purchaser_id` is deprecated; `license.purchaser_account` is
  deprecated;.
- [limeapi] Two new constructor arguments `accountapi` and `storeapi` to 
  specify an Account API and Store API that it can call. Same reasoning as the
  next bullet.
- [storeapi] A new constructor argument `limeapi` to specify the Lime API
  to which the store API can call for Lime info. Before this change it
  would just use a bare `limeapi.LimeAPI` which is a problem when needing
  to override `api_url` -- e.g. for dev/staging.
- [accountapi] `accountapi.Account` object has changed to not subclass from
  dict. E.g. you now use `account.email` instead of `account["email"]`.
- Support for standard HTTP headers used for all requests (settable on
  the class object or in the class constructor).
- Updated API class constructor:
    - New optional `api_url` argument to override. Helpful for
      development/staging environments.
    - [all] Renamed `base_cache_dir` argument to `http_cache_dir`.
    - [notificationsapi] New `auth_*` arguments for adding credentials for
      requests that require auth. These replaces the `username` and
      `password` constructor arguments for `NotificationsAPI`.
- [all] All exceptions are now attributes of the API class. E.g.
  `exampleapi.ExampleAPI.ServerNotFoundError` rather than
  `exampleapi.ServerNotFoundError`. This can simplify some code: (a) You can
  pass an API instance around and it encapsulates the kinds of errors than
  can happen. (b) You can `from exampleapi import ExampleAPI`, freeing up
  `exampleapi` for a variable name.
- Added a "exampleapi.py" demonstration API client class.
- New `_request(...)` and `_request_json(...)` methods replace `_get(...)`,
  `_post(...)`, `_json_get(...)`, etc. The new methods support any HTTP
  method and allow setting custom headers.
- [all] The Python package name is not `activeapis2`.



## activeapis 1.0.0

(Started maintaining this changelog 15 Oct 2009.)


