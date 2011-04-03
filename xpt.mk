compdir=$(pkgdatadir)/components
chromedir=$(pkgdatadir)/chrome
contentdir=$(chromedir)/content
moduledir = $(pkgdatadir)/chrome/modules
prefdir=$(pkgdatadir)/defaults/preferences
%.xpt: %.idl
	$(XPIDL) -m typelib -w -v -I $(IDLDIR) -I `dirname "$<"` -e $@ $<
