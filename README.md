# Failraft

This module extends [`Failboat`](https://github.com/One-com/failboat) to
make it work in conjunction with redux.

Error handlers registered with Failraft are dispatched via the store to which
it is attached - this essentialy allows actions to be triggered in response
to error conditions in the application.

## License

Failraft is licensed under a standard 3-clause BSD
license -- see the `LICENSE`-file for details.
