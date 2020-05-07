# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
# 
# The contents of this file are subject to the Mozilla Public License
# Version 1.1 (the "License"); you may not use this file except in
# compliance with the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
# 
# Software distributed under the License is distributed on an "AS IS"
# basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
# License for the specific language governing rights and limitations
# under the License.
# 
# The Original Code is Komodo code.
# 
# The Initial Developer of the Original Code is ActiveState Software Inc.
# Portions created by ActiveState Software Inc are Copyright (C) 2015-2016
# ActiveState Software Inc. All Rights Reserved.
# 
# Contributor(s):
#   ActiveState Software Inc
# 
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
# 
# ***** END LICENSE BLOCK ***** */

require 'json'

class Scheme
  
  @@colors = [
    [
        ["CommonStyles", "default_fixed", "back"],
        ["CommonStyles", "default_proportional", "back"]
    ],
    [
        ["CommonStyles", "default_fixed", "fore"],
        ["CommonStyles", "default_proportional", "fore"]
    ],
    [["CommonStyles", "comments", "fore"],],
    [["CommonStyles", "keywords", "fore"],],
    [["CommonStyles", "strings", "fore"],],
    [["CommonStyles", "classes", "fore"],],
    [
        ["CommonStyles", "variables", "fore"],
        ["LanguageStyles", "Python", "variables", "fore"],
        ["LanguageStyles", "Ruby", "variables", "fore"],
        ["LanguageStyles", "Tcl", "variables", "fore"],
        ["LanguageStyles", "PHP", "variables", "fore"]
    ],
    [["CommonStyles", "numbers", "fore"],],
    [["CommonStyles", "operators", "fore"],],
    [["CommonStyles", "identifiers", "fore"],]
  ]
  
  def initialize(ksf)
    begin
      ksf = JSON.parse(ksf)
    rescue Exception => e
      puts "Parsing KSF failed: #{e}"
      @ready = false
      return
    end
    
    if ksf.has_key? "exports"
      ksf = ksf["exports"]
    end
    
    @ksf = ksf
    
    @fg = []
    @@colors.each do |options|
        options.each do |option|
            c = self.get(option, ksf)
            if c
                @fg.push self.hex(c)
                break
            end
        end
    end
    @bg = @fg.shift
    @ready = true
  end
  
  def ready
    @ready
  end
  
  def bg
    @bg
  end
  
  def fg
    @fg
  end
  
  def hex(value)
    value = ((value & 0xFF0000) >> 16) +
        (value & 0x00FF00) +
       ((value & 0xFF) << 16)
    return "#" + ("0" + ((value & 0xFF0000) >> 16).to_s(16))[-2..-1] +
             ("0" + ((value &   0xFF00) >>  8).to_s(16))[-2..-1] +
             ("0" + ((value &   0xFF)   >>  0).to_s(16))[-2..-1]
  end
  
  def get(select, ob = false)
    unless ob
      ob = @ksf
    end
    r = ob
    select.each() do |k|
      unless r.has_key? k
        return false
      end
      r = r[k]
    end
    return r
  end
  
  def color(select)
    c = self.get(select)
    unless c
      return ""
    end
    
    return self.hex(c)
  end
  
  def colorFor(key, language, style = "fore")
    c = self.get(["LanguageStyles", language, key, style])
    
    unless c
      c = self.get(["CommonStyles", key, style])
    end
    
    unless c
      return ""
    end
    
    return self.hex(c)
  end
end
