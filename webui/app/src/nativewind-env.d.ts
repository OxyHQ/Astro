// `className` on react-native components.
//
// react-native-css (which NativeWind 5 is built on) augments React Native's
// component props with the styling props it compiles -- `className`,
// `contentContainerClassName` and the rest. The augmentation is not loaded by
// importing the runtime, so without this reference every className in the app
// is a type error while behaving perfectly at run time.
/// <reference types="nativewind/types" />
