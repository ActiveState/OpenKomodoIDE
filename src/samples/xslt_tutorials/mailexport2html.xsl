<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
    <xsl:output indent="yes" method="html"/>
    
    <!-- Setup the basic HTML skeleton -->
    <xsl:template match="/">
        <html>
            <head>
                <title>E-mail</title>
            </head>
            <body>
                <xsl:apply-templates/>
            </body>
        </html>
    </xsl:template>

    <!-- Process the e-mail header. -->
    <xsl:template match="HEADER">
        <span STYLE="color:red; font-weight:bold; font-style:italic">
            <xsl:value-of select="SUBJECT"/>
        </span><br/>
        From: <xsl:call-template name="formatEmail">
                <xsl:with-param name="address" select="ORIGADDRESS"/>
              </xsl:call-template>
        <br/>
        To: <xsl:call-template name="formatEmail">
                <xsl:with-param name="address" select="DESTADDRESS"/>
            </xsl:call-template>
    </xsl:template>
    
    <!-- Process one e-mail message. Process the header first and then
         output the body in a preformatted (pre) tag. --> 
    <xsl:template match="EMAIL">
        <xsl:apply-templates select="HEADER"/>

        <pre>
            <xsl:value-of select="BODY"/>
        </pre>
    </xsl:template>
    
    <!-- Output an e-mail address inside an anchor e.g.
            <a href="mailto:joeb@company.com">joeb@company.com</a>
            The "address" parameter should be a valid e-mail address 
    -->
    <xsl:template name="formatEmail">
        <xsl:param name="address"/>
        <a>
            <xsl:attribute name="href"><xsl:value-of select="concat('mailto:',$address)"/></xsl:attribute>
            <xsl:value-of select="$address"/>
        </a>
    </xsl:template>
</xsl:stylesheet>
