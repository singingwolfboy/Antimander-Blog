import '../style/index.scss'
import { image_data } from './utils'
import ndarray from 'ndarray'
import Regl from 'regl'
import bind_parcoords from './parallel_coords'
import { fetch_json, sum, sample, range, clamp, inView } from './utils'
import { draw_districts } from './draw_command'
import { RunData, StateData } from './datatypes'
import ResultViewer from './ResultViewer'
import SingleResultViewer from './SingleResultViewer'
declare let window: any;

async function load_viewers(regl): Promise<ResultViewer[]> {
    const viewers = []

    // Load the WI state data.
    const [ mapdata, statedata, color_scale, background ]: any[] = await Promise.all([
        image_data(`./data/wards.png`),
        fetch_json(`./data/statedata.json`),
        image_data('imgs/scale_rdbu_1px.png'),
        image_data('imgs/district.png')
    ])

    // Compile webgl shader and enclose data.
    const draw_cmd = draw_districts(regl, mapdata, statedata, color_scale, background, 'districts')
    
    // Load the simgle-viewer for the header.
    const rundata = await fetch_json(`./data/rundata/bias_big.json`)
    console.log(rundata)
    viewers.push(
        new SingleResultViewer(
            draw_cmd, document.querySelector('#header'), rundata
        )
    )
    document.querySelectorAll('.viewer_row').forEach(async (row: HTMLElement) => {
        const datapath = row.dataset.datapath
        const rundata:RunData = await fetch_json(`./data/rundata/${datapath}.json`)
        viewers.push(new ResultViewer(draw_cmd, row, rundata))
    })
    return viewers
}

async function main() {
    const canvas = document.querySelector('canvas.main_canvas') as HTMLCanvasElement
    const regl = Regl({
        canvas,
        extensions: [ 'oes_texture_float' ],
        optionalExtensions: [ 'oes_texture_half_float'],
        attributes: { antialias: true }
    })
    const viewers = await load_viewers(regl)
    let last_scroll = null
    let active_viewer:ResultViewer = viewers[0]
    console.log('Initital active viewer:', active_viewer)
    function step() {
        window.requestAnimationFrame(step)
        if (last_scroll != window.scrollY) {
            viewers.forEach(v => v?.onScroll())
            last_scroll = window.scrollY
        }
        if (!active_viewer) {
            active_viewer = viewers.find(v => inView(v.container))
            if (active_viewer) {
                console.log('Setting active viewer:', active_viewer)
                active_viewer.container.querySelector('.canvas_container').append(canvas)
                active_viewer.needsDraw()
            }
        }
        if (active_viewer) {
            active_viewer.onStep()
            if (!inView(active_viewer.container)) {
                console.log('Making inactive', active_viewer);
                
                active_viewer = null
            }
        }
    }
    const resize = async () =>  {
        // const mobile = window.innerWidth < 800
        // let new_w = viewers[0].viewer.clientWidth
        // let new_h = window.innerHeight - 320
        // if (mobile) {
        //     // let new_w = viewers[0].viewer.clientWidth
        //     new_h = (window.innerHeight / 2) - 100
        //     console.log({new_h});
        // }
        // const base_dim = Math.min(window.innerWidth / 12, 256)
        // const dim = new_h / Math.floor(new_h / base_dim)
        // new_w -= new_w % dim
        // canvas.style.width = new_w + 'px'
        // canvas.style.height = new_h + 'px'
        // // console.log(new_w / dim, new_h / dim)
        viewers.forEach(v => v.onResize())
    }
    canvas.onclick = ({ offsetX: x, offsetY: y }) => {
        const { clientWidth: width, clientHeight: height } = canvas
        active_viewer?.onClick(x / width, y / height)
    }
    canvas.onmousemove = ({ offsetX: x, offsetY: y }) => {
        const { clientWidth: width, clientHeight: height } = canvas
        active_viewer?.onMouseMove(x / width, y / height)
    }
    canvas.onmouseleave = () => {
        active_viewer?.onMouseLeave()
    }
    window.requestAnimationFrame(step)
    window.onresize = resize
    resize()
}

main()
