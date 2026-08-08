// Stands in for deep react-native internals that have no web implementation
// and that monorepo hoisting pulls in transitively. Nothing imports a binding
// from them on web; reaching one is a resolution accident, not a use.
export default {};
