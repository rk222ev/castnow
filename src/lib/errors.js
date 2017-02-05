
const fatalError =  e  => {
  ui.hide(e)
  debug(e)
  console.log(chalk.red(e))
  process.exit()
}
