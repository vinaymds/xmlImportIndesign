<?xml version="1.0"?>
<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">

  <xsl:output indent="no"/>


  <!-- Peek at top-level tag to construct prefix string for renaming tags.
       This prefix may be overridden at run-time by the script caller. -->
  <xsl:param name="prefix" select="name(/*[1])"/>


  <!-- ### IMAGES ### -->

  <!-- Renumber images and captions and hoist them to top level. We give
       lead image and byline image special IDs, and other assets are numbered
       starting from 1. -->
  <xsl:template match="Image | caption"/>

  <xsl:template name="output-image">
    <xsl:param name="img-id"/>

    <xsl:element name="{$prefix}-image-{$img-id}">
      <xsl:copy-of select="@*"/>
    </xsl:element>

    <xsl:for-each select="following-sibling::*[1][self::caption]">
      <xsl:element name="{$prefix}-caption-{$img-id}">
        <xsl:apply-templates/>
      </xsl:element>
    </xsl:for-each>
  </xsl:template>

  <xsl:template match="Image" mode="images-byline">
    <xsl:call-template name="output-image">
      <xsl:with-param name="img-id" select="'byline'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="Image" mode="images-lead">
    <xsl:call-template name="output-image">
      <xsl:with-param name="img-id" select="'lead'"/>
    </xsl:call-template>
  </xsl:template>

  <xsl:template match="Image" mode="images-assets">
    <xsl:call-template name="output-image">
      <xsl:with-param name="img-id" select="position()"/>
    </xsl:call-template>
  </xsl:template>


  <!-- ### TEXT ### -->

  <xsl:template match="p/italic | p/bold | li/italic | li/bold">
    <!-- Name the inline style after the container that holds the paragraph -->
    <xsl:variable name="cont" select="name(ancestor::*[self::lead or
                                                       self::body or
                                                       self::facts or
                                                       self::quote][1])"/>
    <xsl:element name="{$prefix}-{$cont}-{name()}">
      <xsl:apply-templates select="node()"/>
    </xsl:element>
  </xsl:template>

  <xsl:template match="p/a">
    <xsl:apply-templates select="node()"/>
  </xsl:template>

  <xsl:template match="p/br">
    <!-- <xsl:text>&#10;</xsl:text> -->
    <xsl:text>[[\n]]</xsl:text>
  </xsl:template>

  <xsl:template match="ul | ol">
    <xsl:apply-templates select="li"/>
  </xsl:template>

  <!-- Remove whitespace-only text nodes -->
  <xsl:template match="text()
                       [parent::lead or
                        parent::body or
                        parent::facts or
                        parent::quote]
                       [string-length(normalize-space(.)) = 0]"/>

  <!-- Remove asset containers since they are special-cased later on -->
  <xsl:template match="leadAsset | asset"/>


  <!-- ### BYLINES ### -->

  <xsl:template match="bylineName | bylineEmail"/>

  <xsl:template match="bylineName | bylineEmail" mode="bylines">
    <xsl:variable name="num"
                  select="count(preceding-sibling::*[name() =
                          name(current())]) + 1"/>
    <xsl:variable name="total"
                  select="count(following-sibling::*[name() =
                          name(current())]) + $num"/>
    <xsl:variable name="tag">
      <xsl:value-of select="name()"/>

      <!-- Add counter suffix if item number 2 or above -->
      <xsl:if test="$num > 1">
        <xsl:value-of select="concat('-', $num)"/>
      </xsl:if>
    </xsl:variable>

    <xsl:element name="{$prefix}-{$tag}">
      <xsl:apply-templates select="node()"/>

      <!-- Check whether any conjunction text should be added. We'll
           use ", " between items 1..(N-2) and " og " between items
           (N-2)..(N-1). -->
      <xsl:choose>
        <xsl:when test="$num = $total"/>
        <xsl:when test="$num = $total - 1"> og </xsl:when>
        <xsl:otherwise>, </xsl:otherwise>
      </xsl:choose>
    </xsl:element>
  </xsl:template>


  <!-- ### TOP-LEVEL ### -->

  <!-- Process a fixed set of tags -->
  <xsl:template match="headline |
                       lead | lead/p |
                       maintag |
                       body | body/p | body/ul/li | body/ol/li |
                       facts | facts/p | facts/ul/li | facts/ol/li |
                       quote | quote/p">
    <!-- Pick tag name that reflects the element container, and in case of
         paragraphs the container plus any actual pararagraph-level style. -->
    <xsl:variable name="tag">
      <xsl:choose>
        <xsl:when test="self::p[@class]">
          <xsl:value-of select="concat(name(parent::*), '-', @class)"/>
        </xsl:when>

        <xsl:when test="self::p">
          <xsl:value-of select="concat(name(parent::*), '-', 'body')"/>
        </xsl:when>

        <xsl:when test="self::li[parent::ul]">
          <xsl:value-of select="concat(name(ancestor::*[self::body or self::facts][1]), '-', 'bullets')"/>
        </xsl:when>

        <xsl:when test="self::li[parent::ol]">
          <xsl:value-of select="concat(name(ancestor::*[self::body or self::facts][1]), '-', 'list')"/>
        </xsl:when>

        <xsl:otherwise>
          <xsl:value-of select="name()"/>

          <!-- If this is a <quote> or <fact> we want to support more than one
               top-level container. For simplicity the first occurrence will
               just use the tag name verbatim, but subsequent items will get a
               counter value appended. -->
          <xsl:if test="self::facts or self::quote">
            <xsl:variable name="num" select="count(preceding-sibling::*[name() = name(current())]) + 1"/>
            <xsl:if test="$num > 1">
              <xsl:value-of select="concat('-', $num)"/>
            </xsl:if>
          </xsl:if>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>

    <xsl:element name="{$prefix}-{$tag}">
      <xsl:apply-templates select="node()"/>
    </xsl:element>

    <!-- Add end of paragraph marker following some of the elements -->
    <xsl:if test="self::p or self::li">
      <xsl:text>&#10;</xsl:text>
    </xsl:if>
  </xsl:template>


  <!-- Process top-level element -->
  <xsl:template match="/*">
    <xsl:element name="{$prefix}">
      <xsl:apply-templates/>

      <!-- Byline elements -->
      <bylines>
        <xsl:apply-templates select="bylineName"  mode="bylines"/>
        <xsl:apply-templates select="bylineEmail" mode="bylines"/>
      </bylines>

      <!-- Grab images separately at the end -->
      <xsl:apply-templates select="//bylineAsset/Image" mode="images-byline"/>
      <xsl:apply-templates select="//leadAsset/Image"   mode="images-lead"/>
      <xsl:apply-templates select="//asset/Image"       mode="images-assets"/>
    </xsl:element>
  </xsl:template>

</xsl:stylesheet>
