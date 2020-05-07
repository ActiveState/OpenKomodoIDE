
"""A library for talking to Marketo (our email marketing system).
"""

from pprint import pprint, pformat
from activeapis2 import utils, apibase, dateutils



#---- the main API class

class MarketoAPI(apibase.HttpAPIBase):
    """An interface to Marketo interactions provided by Antarctica (our
    intermediary to Marketo).
    """
    DEFAULT_API_URL = "http://activestate.dll1.com/"
    
    class SignupAPIError(apibase.APIBase.APIError):
        """Signup action failed.
        """
    
    def newsletter_signup(self, email, marketo_cookie):
        """Sign up the given user for the AS newsletter.
        
        @param email {str}
        @param marketo_cookie {str} The value of the user's Marketo tracking
            cookie ("_mkto_trk").
        @returns {int} The Marketo ID of the created lead.
        @raises {self.SignupAPIError} if Marketo could not create the lead for
            some reason.
        """
        url = self._api_url + "sso_signups.aspx"
        body = {
            "email": email,
            "marketoCookie": marketo_cookie,
        }
        response = self._request(url, "POST", body)
        if response == "-1":
            raise self.SignupAPIError()
        return int(response)

