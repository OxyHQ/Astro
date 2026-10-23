#import <Foundation/Foundation.h>

#include <string>
#include <vector>

namespace astrocore_host {

void PrepareStartup(NSString *userDataDir, std::vector<std::string> &switches);

}
