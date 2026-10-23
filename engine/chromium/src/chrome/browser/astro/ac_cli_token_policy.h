// Copyright 2026 Oxy. Apache-2.0.

#ifndef CHROME_BROWSER_ASTRO_AC_CLI_TOKEN_POLICY_H_
#define CHROME_BROWSER_ASTRO_AC_CLI_TOKEN_POLICY_H_

#include <memory>

#include "astro/core/ac_content_hooks.h"  // nogncheck

namespace content {
class DevToolsAgentHost;
class DevToolsAgentHostClient;
class RenderFrameHost;
}

namespace astro {

std::unique_ptr<AstroDevToolsTokenClient> CreateTokenClient(
    content::DevToolsAgentHostClient* client,
    content::DevToolsAgentHost* host);

bool TokenClientMayAttach(content::DevToolsAgentHostClient* root_client,
                          content::DevToolsAgentHost* host);

bool TokenClientMayInput(content::DevToolsAgentHostClient* root_client,
                         content::RenderFrameHost* frame);

}

#endif
