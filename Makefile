SHELL = /bin/sh

#include $(BASE_DIR)/ENVIRONMENT

BUILDID = $(shell date +%Y%m%d)

all:
	cp -r application.ini chrome defaults $(RELEASE_DIR)
	sed -i -e 's/BuildID=.\+/BuildID=$(BUILDID)/' $(RELEASE_DIR)/application.ini

%.xpt: %.idl
	$(SDK_DIR)/bin/xpidl -m typelib -w -v -I $(SDK_DIR)/idl -e $@ $<
